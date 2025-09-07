require('dotenv').config();

const securityConfig = {
    // Rate Limiting Configuration
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000, // 1 hour
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 3,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        keyGenerator: (req) => req.ip,
        onLimitReached: (req, res, options) => {
            console.warn(`Rate limit exceeded for IP: ${req.ip}`);
        }
    },

    // Slow Down Configuration (Progressive delays)
    slowDown: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000,
        delayAfter: 1, // Start slowing down after 1 request
        delayMs: parseInt(process.env.SLOW_DOWN_DELAY_MS) || 500,
        maxDelayMs: 5000, // Max delay of 5 seconds
        skipFailedRequests: false,
        skipSuccessfulRequests: false
    },

    // IP Blocking Configuration
    ipBlocking: {
        enabled: true,
        blockDurationHours: parseInt(process.env.IP_BLOCK_DURATION_HOURS) || 24,
        permanentBlockThreshold: parseInt(process.env.IP_PERMANENT_BLOCK_THRESHOLD) || 10,
        suspiciousActivityThreshold: parseInt(process.env.SUSPICIOUS_ACTIVITY_THRESHOLD) || 5,
        whitelist: [
            '127.0.0.1',
            '::1',
            '192.168.0.0/16',
            '10.0.0.0/8',
            '172.16.0.0/12'
        ]
    },

    // reCAPTCHA Configuration
    recaptcha: {
        siteKey: process.env.RECAPTCHA_SITE_KEY,
        secretKey: process.env.RECAPTCHA_SECRET_KEY,
        threshold: parseFloat(process.env.RECAPTCHA_THRESHOLD) || 0.5,
        action: 'contact_form',
        verifyUrl: 'https://www.google.com/recaptcha/api/siteverify'
    },

    // CORS Configuration
    cors: {
        origin: process.env.CORS_ORIGIN ? 
            process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
            ['http://localhost:3000', 'https://localhost:3000'],
        methods: process.env.CORS_ALLOWED_METHODS?.split(',') || ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin',
            'X-CSRF-Token'
        ],
        credentials: true,
        optionsSuccessStatus: 200,
        maxAge: 86400 // 24 hours
    },

    // Helmet Security Headers Configuration
    helmet: {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
                scriptSrc: ["'self'", "https://www.google.com", "https://www.gstatic.com"],
                imgSrc: ["'self'", "data:", "https:"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                connectSrc: ["'self'", "https://www.google.com"],
                frameSrc: ["https://www.google.com"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                childSrc: ["'none'"]
            },
        },
        hsts: {
            maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000, // 1 year
            includeSubDomains: true,
            preload: true
        },
        noSniff: true,
        frameguard: { action: 'deny' },
        xssFilter: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        permittedCrossDomainPolicies: false,
        hidePoweredBy: true
    },

    // Input Validation and Sanitization
    validation: {
        maxInputLength: {
            name: 100,
            email: 254,
            phone: 20,
            equipmentType: 50,
            problemDescription: parseInt(process.env.MAX_MESSAGE_LENGTH) || 2000
        },
        minInputLength: {
            name: 2,
            email: 5,
            phone: 8,
            problemDescription: parseInt(process.env.MIN_MESSAGE_LENGTH) || 10
        },
        patterns: {
            name: /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s'-]+$/,
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            phone: /^[\d\s\-\+\(\)]+$/
        }
    },

    // Anti-Spam Configuration
    antiSpam: {
        enabled: true,
        profanityFilterEnabled: process.env.PROFANITY_FILTER_ENABLED === 'true',
        spamKeywordsFile: process.env.SPAM_KEYWORDS_FILE || './config/spam-keywords.txt',
        spamKeywords: [
            // Common spam words (Spanish)
            'oferta especial', 'click aqui', 'ganar dinero', 'trabajo desde casa',
            'inversion minima', 'dinero facil', 'urgente', 'felicidades has ganado',
            'promocion limitada', 'reclama ahora', 'sin costo', 'gratis total',
            
            // Common spam words (English)
            'make money fast', 'work from home', 'click here now', 'free money',
            'urgent response', 'congratulations you won', 'limited time offer',
            'act now', 'risk free', 'guaranteed income',
            
            // Suspicious patterns
            'viagra', 'casino', 'lottery', 'inheritance', 'bitcoin investment',
            'cryptocurrency', 'forex trading', 'mlm', 'pyramid'
        ],
        suspiciousPatterns: [
            /(.)\1{4,}/gi, // Repeated characters (aaaaa)
            /[A-Z]{10,}/g, // Too many consecutive capitals
            /(.{1,3})\1{5,}/gi, // Repeated patterns
            /\b\d{4,}\s*\d{4,}\b/g, // Credit card-like numbers
            /https?:\/\//gi, // URLs (suspicious in contact forms)
        ],
        maxUrlsAllowed: 0,
        maxCapitalPercentage: 30,
        checkGrammar: true,
        detectFakeEmails: true
    },

    // Session and JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: '24h',
        issuer: process.env.DOMAIN,
        audience: process.env.DOMAIN
    },

    // Monitoring and Logging
    monitoring: {
        enabled: process.env.METRICS_ENABLED === 'true',
        logLevel: process.env.LOG_LEVEL || 'info',
        logSensitiveData: false,
        trackFailedAttempts: true,
        alertThresholds: {
            failedAttemptsPerHour: 50,
            suspiciousActivityPerHour: 20,
            rateLimitExceededPerHour: 100
        }
    },

    // Health Check Configuration
    healthCheck: {
        enabled: process.env.HEALTH_CHECK_ENABLED === 'true',
        endpoint: process.env.HEALTH_CHECK_ENDPOINT || '/health',
        interval: 30000, // 30 seconds
        timeout: 5000, // 5 seconds
        checks: {
            database: true,
            email: true,
            diskSpace: true,
            memory: true
        }
    },

    // Development/Testing Configuration
    development: {
        debugMode: process.env.DEBUG_MODE === 'true',
        verboseLogging: process.env.VERBOSE_LOGGING === 'true',
        testMode: process.env.TEST_MODE === 'true',
        bypassRateLimit: process.env.TEST_MODE === 'true',
        bypassRecaptcha: process.env.TEST_MODE === 'true'
    }
};

// Validation function for critical security settings
function validateSecurityConfig() {
    const errors = [];
    
    if (!securityConfig.recaptcha.secretKey && !securityConfig.development.testMode) {
        errors.push('reCAPTCHA secret key is required');
    }
    
    if (!securityConfig.jwt.secret) {
        errors.push('JWT secret is required');
    }
    
    if (securityConfig.jwt.secret && securityConfig.jwt.secret.length < 32) {
        errors.push('JWT secret should be at least 32 characters long');
    }
    
    if (securityConfig.cors.origin.includes('*') && process.env.NODE_ENV === 'production') {
        errors.push('Wildcard CORS origin should not be used in production');
    }
    
    if (errors.length > 0) {
        throw new Error(`Security configuration errors: ${errors.join(', ')}`);
    }
    
    return true;
}

module.exports = {
    securityConfig,
    validateSecurityConfig
};