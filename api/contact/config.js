const { inputValidator } = require('../_shared/validator');

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
        const config = {
            recaptcha: {
                siteKey: process.env.RECAPTCHA_SITE_KEY,
                action: 'contact_form'
            },
            validation: inputValidator.getValidationSummary(),
            equipmentTypes: ['PC', 'Notebook', 'Netbook', 'All-in-One', 'Gaming PC', 'Workstation', 'Otro'],
            limits: {
                maxRequests: 10,
                windowMs: 3600000,
                maxMessageLength: 2000,
                minMessageLength: 20
            },
            contact: {
                whatsappNumber: process.env.WHATSAPP_NUMBER,
                responseTime: '2-4 horas',
                workingHours: 'Lunes a Viernes: 9:00 - 18:00, Sábados: 9:00 - 14:00'
            }
        };

        return res.json({
            success: true,
            config,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        return res.status(500).json({
            error: 'Error de configuración',
            message: 'No se pudo obtener la configuración del formulario',
            code: 'CONFIG_ERROR'
        });
    }
};
