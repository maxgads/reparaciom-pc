const { database } = require('../backend/utils/supabase-db');
const { emailService } = require('../backend/utils/email');
const packageJson = require('../package.json');

let dbInitialized = false;

async function ensureDatabase() {
    if (!dbInitialized) {
        await database.initialize();
        dbInitialized = true;
    }
}

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await ensureDatabase();

        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: packageJson.version,
            services: {
                database: 'unknown',
                email: 'unknown'
            },
            environment: process.env.NODE_ENV || 'production',
            platform: 'vercel'
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

        const statusCode = healthData.status === 'healthy' ? 200 : 503;
        return res.status(statusCode).json(healthData);

    } catch (error) {
        return res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};
