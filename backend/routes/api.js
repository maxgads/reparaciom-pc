const express = require('express');
const { SecurityLogger, logger } = require('../utils/logger');
const { database } = require('../utils/db');
const { emailService } = require('../utils/email');
const { rateLimiterService } = require('../middleware/rateLimiter');
const { securityMiddleware } = require('../middleware/security');
const packageJson = require('../../package.json');

const router = express.Router();

// Apply rate limiting to API endpoints
router.use(rateLimiterService.createGlobalLimiter());

// API Information endpoint
router.get('/', (req, res) => {
    SecurityLogger.logSecurityEvent('api_info_requested', req);
    
    res.json({
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        endpoints: {
            '/api/contact': 'Contact form endpoints',
            '/api/health': 'System health check',
            '/api/info': 'API information',
            '/api/security': 'Security status',
            '/api/version': 'Version information',
            '/api/webhook/keepalive': 'Keep alive webhook for external services'
        },
        documentation: 'See README.md for detailed API documentation',
        timestamp: new Date().toISOString()
    });
});

// System health check endpoint
router.get('/health', async (req, res) => {
    try {
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: packageJson.version,
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
            },
            services: {
                database: 'unknown',
                email: 'unknown',
                logging: 'active',
                security: 'active'
            },
            environment: process.env.NODE_ENV,
            nodeVersion: process.version
        };

        // Test database
        try {
            await database.healthCheck();
            healthData.services.database = 'healthy';
        } catch (error) {
            healthData.services.database = 'unhealthy';
            healthData.status = 'degraded';
            healthData.issues = healthData.issues || [];
            healthData.issues.push('Database connection failed');
        }

        // Test email service
        try {
            const emailTest = await emailService.testConnection();
            healthData.services.email = emailTest.status === 'success' ? 'healthy' : 'unhealthy';
            if (emailTest.status !== 'success') {
                healthData.status = 'degraded';
                healthData.issues = healthData.issues || [];
                healthData.issues.push('Email service not configured properly');
            }
        } catch (error) {
            healthData.services.email = 'unhealthy';
            healthData.status = 'degraded';
            healthData.issues = healthData.issues || [];
            healthData.issues.push('Email service error');
        }

        SecurityLogger.logHealthCheck('system', healthData.status, healthData);

        const statusCode = healthData.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(healthData);

    } catch (error) {
        logger.error('Health check failed', { error: error.message });
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Security status endpoint
router.get('/security', async (req, res) => {
    try {
        SecurityLogger.logSecurityEvent('security_status_requested', req);

        const securityStatus = {
            status: 'active',
            timestamp: new Date().toISOString(),
            features: {
                rateLimiting: 'enabled',
                ipBlocking: 'enabled',
                spamFiltering: 'enabled',
                recaptcha: 'enabled',
                inputValidation: 'enabled',
                securityHeaders: 'enabled',
                logging: 'enabled',
                compression: 'enabled',
                cors: 'enabled'
            },
            stats: securityMiddleware.getSecurityStats(),
            recentActivity: {
                last24Hours: await this.getRecentSecurityActivity()
            }
        };

        res.json({
            success: true,
            security: securityStatus
        });

    } catch (error) {
        logger.error('Error getting security status', { error: error.message });
        res.status(500).json({
            error: 'Security status error',
            message: 'Could not retrieve security status',
            code: 'SECURITY_STATUS_ERROR'
        });
    }
});

// Version information endpoint
router.get('/version', (req, res) => {
    SecurityLogger.logSecurityEvent('version_requested', req);
    
    res.json({
        version: packageJson.version,
        name: packageJson.name,
        description: packageJson.description,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Keep-alive webhook endpoint for external monitoring services
router.post('/webhook/keepalive', (req, res) => {
    try {
        SecurityLogger.logSecurityEvent('keepalive_webhook_called', req);
        
        const keepaliveData = {
            status: 'alive',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            },
            version: packageJson.version,
            service: 'reparaciones-pc-api',
            ping_response: true
        };

        // Log the external ping
        logger.info('Keep-alive ping received', {
            source: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Service is alive and running',
            data: keepaliveData
        });

    } catch (error) {
        logger.error('Keep-alive webhook error', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Keep-alive check failed',
            message: error.message,
            code: 'KEEPALIVE_ERROR'
        });
    }
});

// GET version of keep-alive for simple monitoring tools
router.get('/webhook/keepalive', (req, res) => {
    try {
        const keepaliveData = {
            status: 'alive',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            service: 'reparaciones-pc-api',
            version: packageJson.version,
            message: 'Service is running normally'
        };

        res.json(keepaliveData);
    } catch (error) {
        logger.error('Keep-alive GET error', { error: error.message });
        res.status(500).json({
            status: 'error',
            message: 'Keep-alive check failed'
        });
    }
});

// System information endpoint (admin only - should be protected)
router.get('/info', async (req, res) => {
    try {
        SecurityLogger.logSecurityEvent('system_info_requested', req);

        // In production, this should check for admin authentication
        const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
        
        if (!isAdmin && process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Admin access required',
                code: 'ADMIN_REQUIRED'
            });
        }

        const systemInfo = {
            server: {
                version: packageJson.version,
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                uptime: process.uptime(),
                pid: process.pid,
                cwd: process.cwd()
            },
            memory: process.memoryUsage(),
            environment: {
                nodeEnv: process.env.NODE_ENV,
                port: process.env.PORT,
                domain: process.env.DOMAIN
            },
            features: {
                database: !!process.env.DB_PATH,
                email: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
                recaptcha: !!(process.env.RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY),
                whatsapp: !!process.env.WHATSAPP_NUMBER
            },
            security: securityMiddleware.getSecurityStats(),
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            info: systemInfo
        });

    } catch (error) {
        logger.error('Error getting system info', { error: error.message });
        res.status(500).json({
            error: 'System info error',
            message: 'Could not retrieve system information',
            code: 'SYSTEM_INFO_ERROR'
        });
    }
});

// Analytics endpoints for real data
router.get('/analytics/stats', async (req, res) => {
    try {
        const period = req.query.period || 7; // días
        
        const [
            totalContacts,
            recentContacts,
            visitsData,
            whatsappClicks,
            pageViews
        ] = await Promise.all([
            database.db.all('SELECT COUNT(*) as count FROM contacts'),
            database.db.all('SELECT COUNT(*) as count FROM contacts WHERE created_at > datetime("now", "-24 hours")'),
            database.db.all(`
                SELECT 
                    date(created_at) as date,
                    COUNT(*) as visits 
                FROM page_visits 
                WHERE created_at > datetime('now', '-${period} days')
                GROUP BY date(created_at)
                ORDER BY date
            `),
            database.db.all('SELECT COUNT(*) as count FROM whatsapp_clicks WHERE created_at > datetime("now", "-24 hours")'),
            database.db.all(`
                SELECT 
                    page_path,
                    COUNT(*) as views
                FROM page_visits 
                WHERE created_at > datetime('now', '-${period} days')
                GROUP BY page_path
                ORDER BY views DESC
                LIMIT 5
            `)
        ]);

        // Calcular visitas totales y de hoy
        const totalVisits = await database.db.all('SELECT COUNT(*) as count FROM page_visits');
        const todayVisits = await database.db.all('SELECT COUNT(*) as count FROM page_visits WHERE date(created_at) = date("now")');

        const stats = {
            totalVisits: totalVisits[0]?.count || 0,
            totalContacts: totalContacts[0]?.count || 0,
            todayVisits: todayVisits[0]?.count || 0,
            whatsappClicks: whatsappClicks[0]?.count || 0,
            visitsChart: visitsData,
            topPages: pageViews,
            period: `${period} days`,
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        logger.error('Error getting analytics stats', { error: error.message });
        res.status(500).json({
            error: 'Analytics stats error',
            message: 'Could not retrieve analytics statistics',
            code: 'ANALYTICS_STATS_ERROR'
        });
    }
});

// Track page visit endpoint
router.post('/analytics/visit', async (req, res) => {
    try {
        const { page, referrer, userAgent } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        
        await database.db.run(`
            INSERT INTO page_visits (page_path, ip_address, user_agent, referrer)
            VALUES (?, ?, ?, ?)
        `, [page, ip, userAgent, referrer || null]);
        
        res.json({ success: true });
    } catch (error) {
        logger.error('Error tracking page visit', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Track WhatsApp click endpoint
router.post('/analytics/whatsapp-click', async (req, res) => {
    try {
        const { equipmentType } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        
        await database.db.run(`
            INSERT INTO whatsapp_clicks (ip_address, equipment_type, user_agent)
            VALUES (?, ?, ?)
        `, [ip, equipmentType || 'unknown', req.get('User-Agent')]);
        
        res.json({ success: true });
    } catch (error) {
        logger.error('Error tracking WhatsApp click', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Database statistics endpoint (admin only)
router.get('/db-stats', async (req, res) => {
    try {
        SecurityLogger.logSecurityEvent('db_stats_requested', req);

        // Check admin access
        const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
        
        if (!isAdmin && process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Admin access required',
                code: 'ADMIN_REQUIRED'
            });
        }

        const [
            recentContacts,
            securityStats,
            blockedIPs,
            rateLimitStats
        ] = await Promise.all([
            database.getRecentContacts(168), // 7 days
            database.getSecurityStats(168), // 7 days
            database.db.all('SELECT * FROM blocked_ips WHERE blocked_until > CURRENT_TIMESTAMP OR permanent = 1'),
            database.db.all('SELECT COUNT(*) as total, ip_address FROM rate_limits GROUP BY ip_address ORDER BY total DESC LIMIT 10')
        ]);

        const stats = {
            contacts: {
                total: recentContacts.length,
                byStatus: {
                    pending: recentContacts.filter(c => c.status === 'pending').length,
                    contacted: recentContacts.filter(c => c.status === 'contacted').length,
                    resolved: recentContacts.filter(c => c.status === 'resolved').length,
                    spam: recentContacts.filter(c => c.status === 'spam').length
                },
                byEquipmentType: recentContacts.reduce((acc, contact) => {
                    acc[contact.equipment_type] = (acc[contact.equipment_type] || 0) + 1;
                    return acc;
                }, {}),
                averageRecaptchaScore: recentContacts.reduce((sum, c) => sum + (c.recaptcha_score || 0), 0) / Math.max(recentContacts.length, 1)
            },
            security: {
                totalEvents: securityStats.reduce((sum, stat) => sum + stat.count, 0),
                eventsByType: securityStats.reduce((acc, stat) => {
                    acc[stat.event_type] = stat.count;
                    return acc;
                }, {}),
                blockedIPs: blockedIPs.length,
                topRateLimitedIPs: rateLimitStats
            },
            period: 'last 7 days',
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        logger.error('Error getting database stats', { error: error.message });
        res.status(500).json({
            error: 'Database stats error',
            message: 'Could not retrieve database statistics',
            code: 'DB_STATS_ERROR'
        });
    }
});

// Clean up old data endpoint (admin only)
router.post('/cleanup', async (req, res) => {
    try {
        SecurityLogger.logSecurityEvent('cleanup_requested', req);

        // Check admin access
        const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
        
        if (!isAdmin && process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Admin access required',
                code: 'ADMIN_REQUIRED'
            });
        }

        await database.cleanupOldRecords();
        
        SecurityLogger.logSecurityEvent('database_cleanup_completed', req);

        res.json({
            success: true,
            message: 'Database cleanup completed successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Database cleanup failed', { error: error.message });
        res.status(500).json({
            error: 'Cleanup error',
            message: 'Database cleanup failed',
            code: 'CLEANUP_ERROR'
        });
    }
});

// Test email endpoint (admin only)
router.post('/test-email', async (req, res) => {
    try {
        SecurityLogger.logSecurityEvent('test_email_requested', req);

        // Check admin access
        const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
        
        if (!isAdmin && process.env.NODE_ENV === 'production') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Admin access required',
                code: 'ADMIN_REQUIRED'
            });
        }

        const testEmail = await emailService.testConnection();
        
        res.json({
            success: testEmail.status === 'success',
            result: testEmail,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Email test failed', { error: error.message });
        res.status(500).json({
            error: 'Email test error',
            message: 'Email test failed',
            code: 'EMAIL_TEST_ERROR'
        });
    }
});

// Helper function to get recent security activity
async function getRecentSecurityActivity() {
    try {
        const activity = await database.db.all(`
            SELECT 
                event_type,
                COUNT(*) as count,
                MAX(created_at) as last_occurrence
            FROM security_logs 
            WHERE created_at > datetime('now', '-24 hours')
            GROUP BY event_type
            ORDER BY count DESC
            LIMIT 10
        `);
        
        return activity;
    } catch (error) {
        logger.error('Error getting recent security activity', { error: error.message });
        return [];
    }
}

// 404 handler for API routes
router.use('*', (req, res) => {
    SecurityLogger.logSecurityEvent('api_endpoint_not_found', req, {
        requestedPath: req.originalUrl,
        method: req.method
    });

    res.status(404).json({
        error: 'API endpoint not found',
        message: 'The requested API endpoint does not exist',
        availableEndpoints: [
            'GET /api/',
            'GET /api/health',
            'GET /api/security',
            'GET /api/version',
            'GET /api/info',
            'GET /api/db-stats',
            'POST /api/cleanup',
            'POST /api/test-email'
        ],
        code: 'API_NOT_FOUND'
    });
});

module.exports = router;