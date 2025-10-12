const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { SecurityLogger } = require('../utils/logger');
const { database } = require('../utils/db');
const { securityConfig } = require('../config/security');

class RateLimiterService {
    constructor() {
        this.ipAttempts = new Map(); // In-memory tracking for additional security
        this.suspiciousIPs = new Set();
    }

    createContactFormLimiter() {
        return rateLimit({
            windowMs: securityConfig.rateLimit.windowMs,
            max: securityConfig.rateLimit.maxRequests,
            skipSuccessfulRequests: false,
            skipFailedRequests: false,
            
            keyGenerator: (req) => {
                return req.ip || req.connection.remoteAddress;
            },

            handler: async (req, res, next) => {
                const ip = req.ip || req.connection.remoteAddress;
                
                SecurityLogger.logRateLimit(req, '/api/contact');
                
                await database.logSecurityEvent({
                    event_type: 'rate_limit_exceeded',
                    ip_address: ip,
                    user_agent: req.get('User-Agent'),
                    request_data: {
                        endpoint: req.path,
                        method: req.method,
                        timestamp: new Date().toISOString()
                    },
                    blocked: true,
                    severity: 'warning',
                    details: `Rate limit exceeded: ${securityConfig.rateLimit.maxRequests} requests in ${securityConfig.rateLimit.windowMs}ms`
                });

                await this.handleRateLimitViolation(ip, req);
                this.markIPAsSuspicious(ip);

                res.status(429).json({
                    error: 'Demasiadas solicitudes',
                    message: `Has excedido el límite de ${securityConfig.rateLimit.maxRequests} consultas por hora. Intenta nuevamente más tarde.`,
                    retryAfter: Math.round(securityConfig.rateLimit.windowMs / 1000),
                    code: 'RATE_LIMIT_EXCEEDED'
                });
            },


            standardHeaders: true,
            legacyHeaders: false,

            store: {
                incr: async (key) => {
                    const ip = key;
                    await database.updateRateLimit(ip, '/api/contact');
                    const rateData = await database.getRateLimit(ip, '/api/contact');
                    return {
                        totalHits: rateData ? rateData.request_count : 1,
                        resetTime: rateData ? new Date(rateData.window_start).getTime() + securityConfig.rateLimit.windowMs : Date.now() + securityConfig.rateLimit.windowMs
                    };
                },
                
                decrement: async (key) => {
                    // No need to decrement in database-based rate limiting
                },
                
                resetAll: async () => {
                    // Database cleanup handles this
                }
            }
        });
    }

    createProgressiveSlowDown() {
        return slowDown({
            windowMs: securityConfig.slowDown.windowMs,
            delayAfter: securityConfig.slowDown.delayAfter,
            delayMs: (used, req) => {
                const delayAfter = securityConfig.slowDown.delayAfter;
                return (used - delayAfter) * securityConfig.slowDown.delayMs;
            },
            maxDelayMs: securityConfig.slowDown.maxDelayMs,
            skipFailedRequests: securityConfig.slowDown.skipFailedRequests,
            skipSuccessfulRequests: securityConfig.slowDown.skipSuccessfulRequests,
            validate: { delayMs: false },

            keyGenerator: (req) => {
                return req.ip || req.connection.remoteAddress;
            },

        });
    }

    checkIPBlocking() {
        return async (req, res, next) => {
            const ip = req.ip || req.connection.remoteAddress;
            
            if (this.isWhitelistedIP(ip)) {
                return next();
            }

            try {
                const blockedIP = await database.isIPBlocked(ip);
                
                if (blockedIP) {
                    SecurityLogger.logSecurityEvent('blocked_ip_attempt', req, {
                        reason: blockedIP.reason,
                        blockedUntil: blockedIP.blocked_until,
                        permanent: blockedIP.permanent
                    });

                    await database.logSecurityEvent({
                        event_type: 'blocked_ip_attempt',
                        ip_address: ip,
                        user_agent: req.get('User-Agent'),
                        request_data: {
                            endpoint: req.path,
                            method: req.method
                        },
                        blocked: true,
                        severity: 'error',
                        details: `Blocked IP attempted access: ${blockedIP.reason}`
                    });

                    return res.status(403).json({
                        error: 'Acceso bloqueado',
                        message: 'Tu dirección IP ha sido bloqueada debido a actividad sospechosa.',
                        code: 'IP_BLOCKED'
                    });
                }

                next();
            } catch (error) {
                console.error('Error checking IP blocking:', error);
                next(); // Continue on error to avoid blocking legitimate users
            }
        };
    }

    async handleRateLimitViolation(ip, req) {
        if (!this.ipAttempts.has(ip)) {
            this.ipAttempts.set(ip, { count: 0, firstViolation: Date.now() });
        }

        const attempts = this.ipAttempts.get(ip);
        attempts.count++;

        const hoursSinceFirst = (Date.now() - attempts.firstViolation) / (1000 * 60 * 60);
        
        if (attempts.count >= securityConfig.ipBlocking.suspiciousActivityThreshold) {
            if (hoursSinceFirst <= 1) {
                const blockDuration = attempts.count >= securityConfig.ipBlocking.permanentBlockThreshold ? null : securityConfig.ipBlocking.blockDurationHours;
                const permanent = attempts.count >= securityConfig.ipBlocking.permanentBlockThreshold;
                
                await database.blockIP(
                    ip, 
                    `Repeated rate limit violations (${attempts.count} violations in ${hoursSinceFirst.toFixed(2)} hours)`,
                    blockDuration,
                    permanent
                );

                SecurityLogger.logSuspiciousActivity(req, 'automatic_ip_blocking', {
                    violationCount: attempts.count,
                    timeSpan: hoursSinceFirst,
                    permanent
                });

                this.ipAttempts.delete(ip);
            }
        }

        setTimeout(() => {
            if (this.ipAttempts.has(ip)) {
                const current = this.ipAttempts.get(ip);
                if (Date.now() - current.firstViolation > 3600000) { // 1 hour
                    this.ipAttempts.delete(ip);
                }
            }
        }, 3600000);
    }

    markIPAsSuspicious(ip) {
        this.suspiciousIPs.add(ip);
        
        setTimeout(() => {
            this.suspiciousIPs.delete(ip);
        }, 3600000); // Remove from suspicious list after 1 hour
    }

    isWhitelistedIP(ip) {
        return securityConfig.ipBlocking.whitelist.some(whitelistedIP => {
            if (whitelistedIP.includes('/')) {
                // CIDR notation
                return this.isIPInCIDR(ip, whitelistedIP);
            }
            return ip === whitelistedIP;
        });
    }

    isIPInCIDR(ip, cidr) {
        try {
            const [network, prefixLength] = cidr.split('/');
            const ipNum = this.ipToNumber(ip);
            const networkNum = this.ipToNumber(network);
            const mask = (0xFFFFFFFF << (32 - parseInt(prefixLength))) >>> 0;
            
            return (ipNum & mask) === (networkNum & mask);
        } catch (error) {
            return false;
        }
    }

    ipToNumber(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    }

    createGlobalLimiter() {
        return rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 100, // Limit each IP to 100 requests per windowMs
            standardHeaders: true,
            legacyHeaders: false,
            
            handler: (req, res) => {
                SecurityLogger.logRateLimit(req, 'global');
                res.status(429).json({
                    error: 'Demasiadas solicitudes',
                    message: 'Has realizado demasiadas solicitudes muy rápido. Reduce la velocidad.',
                    code: 'GLOBAL_RATE_LIMIT_EXCEEDED'
                });
            }
        });
    }

    async getIPStatistics(ip) {
        try {
            const rateData = await database.getRateLimit(ip, '/api/contact');
            const securityEvents = await database.db.all(
                'SELECT event_type, COUNT(*) as count FROM security_logs WHERE ip_address = ? AND created_at > datetime("now", "-24 hours") GROUP BY event_type',
                [ip]
            );

            return {
                ip,
                currentRequests: rateData ? rateData.request_count : 0,
                windowStart: rateData ? rateData.window_start : null,
                isSuspicious: this.suspiciousIPs.has(ip),
                securityEvents: securityEvents,
                isWhitelisted: this.isWhitelistedIP(ip)
            };
        } catch (error) {
            return { ip, error: error.message };
        }
    }

    cleanup() {
        const now = Date.now();
        const oneHourAgo = now - 3600000;

        for (const [ip, data] of this.ipAttempts.entries()) {
            if (data.firstViolation < oneHourAgo) {
                this.ipAttempts.delete(ip);
            }
        }

        for (const ip of this.suspiciousIPs) {
            this.suspiciousIPs.delete(ip);
        }
    }
}

const rateLimiterService = new RateLimiterService();

setInterval(() => {
    rateLimiterService.cleanup();
}, 300000); // Cleanup every 5 minutes

module.exports = {
    RateLimiterService,
    rateLimiterService
};