const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const logDir = process.env.LOG_DIR || './logs';

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        return JSON.stringify({
            timestamp,
            level: level.toUpperCase(),
            message,
            ...meta
        });
    })
);

const securityTransport = new DailyRotateFile({
    filename: path.join(logDir, 'security-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    level: 'info',
    format: logFormat
});

const errorTransport = new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    level: 'error',
    format: logFormat
});

const combinedTransport = new DailyRotateFile({
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    format: logFormat
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        combinedTransport,
        errorTransport,
        securityTransport
    ]
});

if (process.env.NODE_ENV !== 'production' || process.env.VERBOSE_LOGGING === 'true') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf((info) => {
                const { timestamp, level, message, ...meta } = info;
                const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                return `${timestamp} ${level}: ${message} ${metaString}`;
            })
        )
    }));
}

class SecurityLogger {
    static logContactAttempt(req, data, status = 'success') {
        const logData = {
            event: 'CONTACT_ATTEMPT',
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            status,
            contactData: {
                name: data.name,
                email: data.email,
                phone: data.phone,
                equipmentType: data.equipment_type
            },
            recaptchaScore: data.recaptcha_score,
            timestamp: new Date().toISOString()
        };

        if (status === 'success') {
            logger.info('Contact form submitted successfully', logData);
        } else {
            logger.warn('Contact form submission failed', { ...logData, reason: status });
        }
    }

    static logSpamDetection(req, reason, data = {}) {
        const logData = {
            event: 'SPAM_DETECTED',
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            reason,
            data,
            severity: 'HIGH',
            timestamp: new Date().toISOString()
        };

        logger.warn('Spam attempt detected and blocked', logData);
    }

    static logRateLimit(req, endpoint) {
        const logData = {
            event: 'RATE_LIMIT_EXCEEDED',
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            endpoint,
            severity: 'MEDIUM',
            timestamp: new Date().toISOString()
        };

        logger.warn('Rate limit exceeded', logData);
    }

    static logSuspiciousActivity(req, activity, details = {}) {
        const logData = {
            event: 'SUSPICIOUS_ACTIVITY',
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            activity,
            details,
            severity: 'HIGH',
            timestamp: new Date().toISOString()
        };

        logger.error('Suspicious activity detected', logData);
    }

    static logValidationError(req, field, value, error) {
        const logData = {
            event: 'VALIDATION_ERROR',
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            field,
            value: typeof value === 'string' ? value.substring(0, 100) : value,
            error,
            timestamp: new Date().toISOString()
        };

        logger.warn('Input validation failed', logData);
    }

    static logIPBlocked(ip, reason, duration = null) {
        const logData = {
            event: 'IP_BLOCKED',
            ip,
            reason,
            duration,
            severity: 'HIGH',
            timestamp: new Date().toISOString()
        };

        logger.error('IP address blocked', logData);
    }

    static logSecurityEvent(eventType, req, details = {}) {
        const logData = {
            event: eventType,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            method: req.method,
            url: req.originalUrl,
            details,
            timestamp: new Date().toISOString()
        };

        logger.info('Security event logged', logData);
    }

    static logServerStart() {
        logger.info('Server started successfully', {
            event: 'SERVER_START',
            port: process.env.PORT,
            nodeEnv: process.env.NODE_ENV,
            timestamp: new Date().toISOString()
        });
    }

    static logDatabaseConnection(status, details = {}) {
        const logData = {
            event: 'DATABASE_CONNECTION',
            status,
            details,
            timestamp: new Date().toISOString()
        };

        if (status === 'success') {
            logger.info('Database connected successfully', logData);
        } else {
            logger.error('Database connection failed', logData);
        }
    }

    static logEmailSent(to, subject, status) {
        const logData = {
            event: 'EMAIL_SENT',
            to: to.replace(/(.{2}).*(@.*)/, '$1***$2'), // Partial email masking
            subject,
            status,
            timestamp: new Date().toISOString()
        };

        if (status === 'success') {
            logger.info('Email sent successfully', logData);
        } else {
            logger.error('Email sending failed', logData);
        }
    }

    static logBackup(status, details = {}) {
        const logData = {
            event: 'BACKUP_OPERATION',
            status,
            details,
            timestamp: new Date().toISOString()
        };

        if (status === 'success') {
            logger.info('Backup completed successfully', logData);
        } else {
            logger.error('Backup operation failed', logData);
        }
    }

    static logHealthCheck(component, status, details = {}) {
        const logData = {
            event: 'HEALTH_CHECK',
            component,
            status,
            details,
            timestamp: new Date().toISOString()
        };

        logger.info('Health check performed', logData);
    }
}

logger.on('error', (err) => {
    console.error('Logger error:', err);
});

securityTransport.on('error', (err) => {
    console.error('Security log transport error:', err);
});

errorTransport.on('error', (err) => {
    console.error('Error log transport error:', err);
});

combinedTransport.on('error', (err) => {
    console.error('Combined log transport error:', err);
});

module.exports = {
    logger,
    SecurityLogger
};