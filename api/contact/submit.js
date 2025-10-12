const axios = require('axios');
const { database } = require('../_shared/supabase-db');
const { inputValidator } = require('../_shared/validator');
const { emailService } = require('../_shared/email');
const { securityConfig } = require('../_shared/security');
const { logger, SecurityLogger } = require('../_shared/logger');

class RecaptchaService {
    constructor() {
        this.secretKey = process.env.RECAPTCHA_SECRET_KEY;
        this.threshold = parseFloat(process.env.RECAPTCHA_THRESHOLD) || 0.5;
        this.verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    }

    async verifyToken(token, ip) {
        if (process.env.BYPASS_RECAPTCHA === 'true') {
            return { success: true, score: 0.9, action: 'contact_form' };
        }

        try {
            const response = await axios.post(this.verifyUrl, null, {
                params: {
                    secret: this.secretKey,
                    response: token,
                    remoteip: ip
                },
                timeout: 5000
            });

            const result = response.data;

            if (!result.success) {
                logger.warn('reCAPTCHA verification failed', {
                    errorCodes: result['error-codes'],
                    ip
                });
                return { success: false, errors: result['error-codes'] };
            }

            return {
                success: true,
                score: result.score || 1.0,
                action: result.action,
                challenge_ts: result.challenge_ts,
                hostname: result.hostname
            };

        } catch (error) {
            logger.error('reCAPTCHA verification error', {
                error: error.message,
                ip
            });
            return { success: false, error: error.message };
        }
    }
}

const recaptchaService = new RecaptchaService();

// Initialize database connection
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Only POST method is allowed',
            code: 'METHOD_NOT_ALLOWED'
        });
    }

    const startTime = Date.now();
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    try {
        // Ensure database is initialized
        await ensureDatabase();

        const { name, email, phone, equipment_type, problem_description, recaptcha_token } = req.body;

        // Basic validation
        if (!name || !email || !phone || !equipment_type || !problem_description || !recaptcha_token) {
            return res.status(400).json({
                error: 'Datos incompletos',
                message: 'Todos los campos son requeridos',
                code: 'MISSING_FIELDS'
            });
        }

        // Verify reCAPTCHA
        const recaptchaResult = await recaptchaService.verifyToken(recaptcha_token, ip);

        if (!recaptchaResult.success) {
            await database.logSecurityEvent({
                event_type: 'spam_detected',
                ip_address: ip,
                user_agent: userAgent,
                request_data: {
                    errors: recaptchaResult.errors || [recaptchaResult.error]
                },
                blocked: true,
                severity: 'warning',
                details: 'reCAPTCHA verification failed'
            });

            return res.status(400).json({
                error: 'Verificación fallida',
                message: 'No se pudo verificar que eres humano. Por favor intenta nuevamente.',
                code: 'RECAPTCHA_FAILED'
            });
        }

        // Check reCAPTCHA score threshold
        if (recaptchaResult.score < recaptchaService.threshold) {
            await database.logSecurityEvent({
                event_type: 'spam_detected',
                ip_address: ip,
                user_agent: userAgent,
                request_data: {
                    score: recaptchaResult.score,
                    threshold: recaptchaService.threshold,
                    name: name.substring(0, 50),
                    email
                },
                blocked: true,
                severity: 'warning',
                details: `Low reCAPTCHA score: ${recaptchaResult.score}`
            });

            return res.status(403).json({
                error: 'Actividad sospechosa',
                message: 'Tu solicitud parece ser automatizada. Si eres humano, intenta nuevamente.',
                code: 'SUSPICIOUS_ACTIVITY'
            });
        }

        // Prepare contact data
        const contactData = {
            name: inputValidator.sanitizeInput(name, 'name'),
            email: inputValidator.sanitizeInput(email, 'html'),
            phone: inputValidator.sanitizeInput(phone, 'phone'),
            equipment_type: inputValidator.sanitizeInput(equipment_type, 'html'),
            problem_description: inputValidator.sanitizeInput(problem_description, 'html'),
            ip_address: ip,
            user_agent: userAgent,
            recaptcha_score: recaptchaResult.score,
            status: 'pending'
        };

        // Additional validation
        const emailValidation = await inputValidator.validateEmail(contactData.email);
        if (!emailValidation.valid) {
            return res.status(400).json({
                error: 'Email inválido',
                message: emailValidation.reason,
                code: 'INVALID_EMAIL'
            });
        }

        const phoneValidation = await inputValidator.validatePhoneNumber(contactData.phone);
        if (!phoneValidation.valid) {
            return res.status(400).json({
                error: 'Teléfono inválido',
                message: phoneValidation.reason,
                code: 'INVALID_PHONE'
            });
        }

        // Save to database
        const insertResult = await database.insertContact(contactData);
        contactData.id = insertResult.id;

        // Send emails
        const emailResults = await emailService.sendBothEmails(contactData);

        // Log successful contact attempt
        await database.logSecurityEvent({
            event_type: 'contact_attempt',
            ip_address: ip,
            user_agent: userAgent,
            request_data: {
                name: contactData.name,
                email: contactData.email,
                equipment_type: contactData.equipment_type,
                recaptcha_score: recaptchaResult.score,
                contact_id: insertResult.id
            },
            blocked: false,
            severity: 'info',
            details: 'Contact form submitted successfully'
        });

        const processingTime = Date.now() - startTime;

        // Response
        const response = {
            success: true,
            message: '¡Consulta enviada exitosamente!',
            details: {
                confirmationId: insertResult.id,
                estimatedResponse: '2-4 horas',
                emailSent: emailResults.clientEmail === 'sent',
                whatsappLink: `https://wa.me/${process.env.WHATSAPP_NUMBER}?text=Hola! Vi tu página web y necesito ayuda con mi ${contactData.equipment_type}`,
                nextSteps: [
                    'Recibirás un email de confirmación',
                    'Revisaremos tu consulta en detalle',
                    'Te contactaremos con un presupuesto',
                    'Coordinaremos la revisión técnica'
                ]
            },
            code: 'CONTACT_SUCCESS'
        };

        // Add warnings if email failed
        if (emailResults.clientEmail === 'failed' || emailResults.techEmail === 'failed') {
            response.warnings = [];
            if (emailResults.clientEmail === 'failed') {
                response.warnings.push('No se pudo enviar el email de confirmación');
            }
            if (emailResults.techEmail === 'failed') {
                response.warnings.push('Notificación técnica falló');
            }
        }

        logger.info('Contact form processed successfully', {
            contactId: insertResult.id,
            processingTime,
            clientEmail: emailResults.clientEmail,
            techEmail: emailResults.techEmail,
            recaptchaScore: recaptchaResult.score
        });

        return res.status(201).json(response);

    } catch (error) {
        logger.error('Contact form processing error', {
            error: error.message,
            stack: error.stack,
            ip,
            body: {
                name: req.body.name?.substring(0, 50),
                email: req.body.email,
                equipment_type: req.body.equipment_type
            }
        });

        await database.logSecurityEvent({
            event_type: 'validation_failed',
            ip_address: ip,
            user_agent: userAgent,
            request_data: {
                error: error.message,
                name: req.body.name?.substring(0, 50),
                email: req.body.email
            },
            blocked: false,
            severity: 'error',
            details: 'Contact form processing failed'
        }).catch(err => logger.error('Failed to log error', { err: err.message }));

        return res.status(500).json({
            error: 'Error interno',
            message: 'Ha ocurrido un error procesando tu consulta. Por favor intenta nuevamente o contáctanos directamente.',
            code: 'PROCESSING_ERROR',
            support: {
                whatsapp: `https://wa.me/${process.env.WHATSAPP_NUMBER}`,
                email: process.env.EMAIL_TO
            }
        });
    }
};
