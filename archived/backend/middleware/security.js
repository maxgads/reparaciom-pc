const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { SecurityLogger, logger } = require('../utils/logger');
const { securityConfig, validateSecurityConfig } = require('../config/security');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');

class SecurityMiddleware {
    constructor() {
        this.suspiciousUserAgents = new Set();
        this.requestCounts = new Map();
        
        try {
            validateSecurityConfig();
            logger.info('Security configuration validated successfully');
        } catch (error) {
            logger.error('Security configuration validation failed', { error: error.message });
            throw error;
        }
    }

    getHelmetConfig() {
        return helmet({
            contentSecurityPolicy: {
                directives: securityConfig.helmet.contentSecurityPolicy.directives,
                reportOnly: false
            },
            crossOriginEmbedderPolicy: false, // Compatibility with some browsers
            hsts: {
                maxAge: securityConfig.helmet.hsts.maxAge,
                includeSubDomains: securityConfig.helmet.hsts.includeSubDomains,
                preload: securityConfig.helmet.hsts.preload
            },
            noSniff: securityConfig.helmet.noSniff,
            frameguard: securityConfig.helmet.frameguard,
            xssFilter: securityConfig.helmet.xssFilter,
            referrerPolicy: securityConfig.helmet.referrerPolicy,
            permittedCrossDomainPolicies: securityConfig.helmet.permittedCrossDomainPolicies,
            hidePoweredBy: securityConfig.helmet.hidePoweredBy
        });
    }

    getCorsConfig() {
        return cors({
            origin: (origin, callback) => {
                if (!origin) return callback(null, true); // Allow requests with no origin (mobile apps, etc.)
                
                if (securityConfig.cors.origin.includes(origin) || 
                    securityConfig.cors.origin.includes('*')) {
                    return callback(null, true);
                }
                
                logger.warn('CORS origin blocked', { origin });
                return callback(new Error('CORS policy violation'), false);
            },
            methods: securityConfig.cors.methods,
            allowedHeaders: securityConfig.cors.allowedHeaders,
            credentials: securityConfig.cors.credentials,
            optionsSuccessStatus: securityConfig.cors.optionsSuccessStatus,
            maxAge: securityConfig.cors.maxAge
        });
    }

    getCompressionConfig() {
        return compression({
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            },
            threshold: 1024,
            level: 6
        });
    }

    getLoggingConfig() {
        const morganFormat = process.env.NODE_ENV === 'production' 
            ? 'combined' 
            : 'dev';

        return morgan(morganFormat, {
            stream: {
                write: (message) => {
                    logger.info(message.trim(), { component: 'http' });
                }
            },
            skip: (req, res) => {
                // Skip logging for health checks and static files
                return req.url === '/health' || 
                       req.url.startsWith('/static/') ||
                       res.statusCode < 400;
            }
        });
    }

    securityAnalysis() {
        return async (req, res, next) => {
            const startTime = Date.now();
            const ip = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent') || 'Unknown';
            
            try {
                // Parse user agent
                const parsedUA = UAParser(userAgent);
                req.userAgentInfo = parsedUA;

                // Get geolocation
                const geo = geoip.lookup(ip);
                req.geoInfo = geo;

                // Analyze request for suspicious patterns
                await this.analyzeSuspiciousActivity(req);

                // Track request metrics
                this.trackRequestMetrics(req);

                // Log security event
                SecurityLogger.logSecurityEvent('request_analyzed', req, {
                    userAgent: parsedUA,
                    geo: geo,
                    processingTime: Date.now() - startTime
                });

                next();
            } catch (error) {
                logger.error('Security analysis error', { 
                    error: error.message,
                    ip,
                    userAgent: userAgent.substring(0, 200)
                });
                next(); // Continue on error
            }
        };
    }

    async analyzeSuspiciousActivity(req) {
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || '';
        const referer = req.get('Referer') || '';
        
        let suspiciousScore = 0;
        const suspiciousReasons = [];

        // Check for bot-like user agents
        const botPatterns = [
            /curl/i, /wget/i, /python/i, /requests/i, /scrapy/i,
            /bot/i, /crawler/i, /spider/i, /scraper/i,
            /headless/i, /phantom/i, /selenium/i, /webdriver/i
        ];

        for (const pattern of botPatterns) {
            if (pattern.test(userAgent)) {
                suspiciousScore += 30;
                suspiciousReasons.push(`Bot-like user agent: ${pattern.source}`);
                this.suspiciousUserAgents.add(userAgent);
                break;
            }
        }

        // Check for missing or suspicious user agent
        if (!userAgent || userAgent.length < 10) {
            suspiciousScore += 20;
            suspiciousReasons.push('Missing or very short user agent');
        }

        // Check for suspicious referers
        if (referer) {
            const suspiciousRefererPatterns = [
                /\.tk$/i, /\.ml$/i, /\.ga$/i, /\.cf$/i, // Free domains
                /bit\.ly/i, /tinyurl/i, /goo\.gl/i, // URL shorteners
                /localhost/i, /127\.0\.0\.1/i // Local development (suspicious in production)
            ];

            for (const pattern of suspiciousRefererPatterns) {
                if (pattern.test(referer)) {
                    suspiciousScore += 15;
                    suspiciousReasons.push(`Suspicious referer: ${pattern.source}`);
                }
            }
        }

        // Check for missing Accept header
        if (!req.get('Accept')) {
            suspiciousScore += 10;
            suspiciousReasons.push('Missing Accept header');
        }

        // Check for suspicious Accept-Language patterns
        const acceptLanguage = req.get('Accept-Language');
        if (!acceptLanguage) {
            suspiciousScore += 10;
            suspiciousReasons.push('Missing Accept-Language header');
        }

        // Check for TOR exit nodes (basic check)
        if (this.isTorExitNode(ip)) {
            suspiciousScore += 25;
            suspiciousReasons.push('TOR exit node detected');
        }

        // Check request frequency from this IP
        const recentRequests = this.getRecentRequestCount(ip);
        if (recentRequests > 50) { // More than 50 requests in last minute
            suspiciousScore += 20;
            suspiciousReasons.push(`High request frequency: ${recentRequests} requests/minute`);
        }

        // Store suspicion analysis
        req.suspicionAnalysis = {
            score: suspiciousScore,
            reasons: suspiciousReasons,
            isSuspicious: suspiciousScore >= 40
        };

        // Log if suspicious
        if (suspiciousScore >= 40) {
            SecurityLogger.logSuspiciousActivity(req, 'high_suspicion_score', {
                score: suspiciousScore,
                reasons: suspiciousReasons,
                userAgent: userAgent.substring(0, 200),
                referer: referer.substring(0, 200)
            });
        }
    }

    trackRequestMetrics(req) {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const minuteAgo = now - 60000;

        if (!this.requestCounts.has(ip)) {
            this.requestCounts.set(ip, []);
        }

        const requests = this.requestCounts.get(ip);
        requests.push(now);

        // Clean old requests
        this.requestCounts.set(ip, requests.filter(time => time > minuteAgo));
    }

    getRecentRequestCount(ip) {
        const requests = this.requestCounts.get(ip) || [];
        return requests.length;
    }

    isTorExitNode(ip) {
        // Basic TOR detection - in production, use a more comprehensive list
        const knownTorExitNodes = [
            // Add known TOR exit node IPs
            // This is a simplified example - use a real TOR exit node list
        ];
        
        return knownTorExitNodes.includes(ip);
    }

    responseHeaderSecurity() {
        return (req, res, next) => {
            // Add custom security headers
            res.setHeader('X-Request-ID', req.id || Date.now().toString());
            res.setHeader('X-Response-Time', Date.now());
            
            // Remove sensitive headers
            res.removeHeader('X-Powered-By');
            res.removeHeader('Server');
            
            // Add security headers not covered by helmet
            res.setHeader('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            next();
        };
    }

    errorHandler() {
        return (err, req, res, next) => {
            const ip = req.ip || req.connection.remoteAddress;
            
            // Log the error
            SecurityLogger.logSecurityEvent('error_occurred', req, {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });

            // Don't leak error details in production
            const isDevelopment = process.env.NODE_ENV === 'development';
            
            res.status(err.status || 500).json({
                error: 'Error interno del servidor',
                message: isDevelopment ? err.message : 'Ha ocurrido un error inesperado',
                ...(isDevelopment && { stack: err.stack }),
                code: 'INTERNAL_SERVER_ERROR'
            });
        };
    }

    notFoundHandler() {
        return (req, res) => {
            SecurityLogger.logSecurityEvent('page_not_found', req, {
                requestedPath: req.originalUrl,
                method: req.method
            });

            res.status(404).json({
                error: 'Página no encontrada',
                message: 'El recurso solicitado no existe',
                code: 'NOT_FOUND'
            });
        };
    }

    healthCheck() {
        return (req, res) => {
            const healthData = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.version,
                environment: process.env.NODE_ENV,
                services: {
                    database: 'connected', // This should be checked dynamically
                    email: 'configured',   // This should be checked dynamically
                    logging: 'active'
                }
            };

            SecurityLogger.logHealthCheck('api', 'healthy', healthData);
            res.json(healthData);
        };
    }

    requestId() {
        return (req, res, next) => {
            req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            res.setHeader('X-Request-ID', req.id);
            next();
        };
    }

    cleanup() {
        // Clean up old data periodically
        const now = Date.now();
        const fiveMinutesAgo = now - 300000;

        for (const [ip, requests] of this.requestCounts.entries()) {
            const recentRequests = requests.filter(time => time > fiveMinutesAgo);
            if (recentRequests.length === 0) {
                this.requestCounts.delete(ip);
            } else {
                this.requestCounts.set(ip, recentRequests);
            }
        }

        // Clean suspicious user agents cache
        if (this.suspiciousUserAgents.size > 1000) {
            this.suspiciousUserAgents.clear();
        }
    }

    getSecurityStats() {
        return {
            suspiciousUserAgents: this.suspiciousUserAgents.size,
            trackedIPs: this.requestCounts.size,
            totalRequests: Array.from(this.requestCounts.values())
                .reduce((total, requests) => total + requests.length, 0),
            configuredOrigins: securityConfig.cors.origin,
            helmetEnabled: true,
            compressionEnabled: true
        };
    }
}

const securityMiddleware = new SecurityMiddleware();

// Cleanup old data every 5 minutes
setInterval(() => {
    securityMiddleware.cleanup();
}, 300000);

module.exports = {
    SecurityMiddleware,
    securityMiddleware
};