const { database } = require('../_shared/supabase-db');
const { logger } = require('../_shared/logger');

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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        await ensureDatabase();

        const { equipmentType } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        const { error } = await database.supabase
            .from('whatsapp_clicks')
            .insert([{
                ip_address: ip,
                equipment_type: equipmentType || 'unknown',
                user_agent: req.headers['user-agent']
            }]);

        if (error) throw error;

        return res.json({ success: true });

    } catch (error) {
        logger.error('Error tracking WhatsApp click', { error: error.message });
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
