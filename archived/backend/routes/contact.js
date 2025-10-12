const express = require('express');
const axios = require('axios');
const { inputValidator } = require('../middleware/validator');
const { rateLimiterService } = require('../middleware/rateLimiter');
const { SecurityLogger, logger } = require('../utils/logger');
const { database } = require('../utils/db');
const { emailService } = require('../utils/email');
const { securityConfig } = require('../config/security');

const router = express.Router();

class RecaptchaService {
    constructor() {
        this.secretKey = securityConfig.recaptcha.secretKey;
        this.threshold = securityConfig.recaptcha.threshold;
        this.verifyUrl = securityConfig.recaptcha.verifyUrl;
    }

    async verifyToken(token, ip) {
        if (securityConfig.development.bypassRecaptcha) {
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

// Apply rate limiting specifically to contact form
router.use('/submit', rateLimiterService.createContactFormLimiter());
router.use('/submit', rateLimiterService.createProgressiveSlowDown());

// Contact form submission endpoint
router.post('/submit', 
    // Apply input validation rules
    ...inputValidator.getContactValidationRules(),
    
    // Validate input data (call the async function to get the middleware)
    (req, res, next) => {
        inputValidator.validateContactInput()
            .then(middleware => middleware(req, res, next))
            .catch(next);
    },
    
    // Check for spam content (call the async function to get the middleware)
    (req, res, next) => {
        inputValidator.checkSpamContent()
            .then(middleware => middleware(req, res, next))
            .catch(next);
    },
    
    async (req, res) => {
        const startTime = Date.now();
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || 'Unknown';
        
        try {
            const { name, email, phone, equipment_type, problem_description, recaptcha_token } = req.body;
            
            // Verify reCAPTCHA
            const recaptchaResult = await recaptchaService.verifyToken(recaptcha_token, ip);
            
            if (!recaptchaResult.success) {
                SecurityLogger.logValidationError(req, 'recaptcha_token', recaptcha_token, 'reCAPTCHA verification failed');
                
                await database.logSecurityEvent({
                    event_type: 'recaptcha_failed',
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
                SecurityLogger.logSpamDetection(req, 'Low reCAPTCHA score', {
                    score: recaptchaResult.score,
                    threshold: recaptchaService.threshold
                });

                await database.logSecurityEvent({
                    event_type: 'recaptcha_low_score',
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
                SecurityLogger.logValidationError(req, 'email', contactData.email, emailValidation.reason);
                return res.status(400).json({
                    error: 'Email inválido',
                    message: emailValidation.reason,
                    code: 'INVALID_EMAIL'
                });
            }

            const phoneValidation = await inputValidator.validatePhoneNumber(contactData.phone);
            if (!phoneValidation.valid) {
                SecurityLogger.logValidationError(req, 'phone', contactData.phone, phoneValidation.reason);
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
            SecurityLogger.logContactAttempt(req, contactData, 'success');

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

            res.status(201).json(response);

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

            SecurityLogger.logSecurityEvent('contact_form_error', req, {
                error: error.message,
                processingTime: Date.now() - startTime
            });

            await database.logSecurityEvent({
                event_type: 'contact_form_error',
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
            });

            res.status(500).json({
                error: 'Error interno',
                message: 'Ha ocurrido un error procesando tu consulta. Por favor intenta nuevamente o contáctanos directamente.',
                code: 'PROCESSING_ERROR',
                support: {
                    whatsapp: `https://wa.me/${process.env.WHATSAPP_NUMBER}`,
                    email: process.env.EMAIL_TO
                }
            });
        }
    }
);

// Get contact form configuration (for frontend)
router.get('/config', async (req, res) => {
    try {
        SecurityLogger.logSecurityEvent('config_requested', req);

        const config = {
            recaptcha: {
                siteKey: securityConfig.recaptcha.siteKey,
                action: securityConfig.recaptcha.action
            },
            validation: inputValidator.getValidationSummary(),
            equipmentTypes: ['PC', 'Notebook', 'Netbook', 'All-in-One', 'Gaming PC', 'Workstation', 'Otro'],
            limits: {
                maxRequests: securityConfig.rateLimit.maxRequests,
                windowMs: securityConfig.rateLimit.windowMs,
                maxMessageLength: securityConfig.validation.maxInputLength.problemDescription,
                minMessageLength: securityConfig.validation.minInputLength.problemDescription
            },
            contact: {
                whatsappNumber: process.env.WHATSAPP_NUMBER,
                responseTime: '2-4 horas',
                workingHours: 'Lunes a Viernes: 9:00 - 18:00, Sábados: 9:00 - 14:00'
            }
        };

        res.json({
            success: true,
            config,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Error getting contact config', { error: error.message });
        res.status(500).json({
            error: 'Error de configuración',
            message: 'No se pudo obtener la configuración del formulario',
            code: 'CONFIG_ERROR'
        });
    }
});

// Health check for contact system
router.get('/health', async (req, res) => {
    try {
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'unknown',
                email: 'unknown',
                recaptcha: 'unknown'
            }
        };

        // Test database connection
        try {
            await database.healthCheck();
            healthData.services.database = 'healthy';
        } catch (error) {
            healthData.services.database = 'unhealthy';
            healthData.status = 'degraded';
        }

        // Test email service
        try {
            const emailTest = await emailService.testConnection();
            healthData.services.email = emailTest.status === 'success' ? 'healthy' : 'unhealthy';
            if (emailTest.status !== 'success') {
                healthData.status = 'degraded';
            }
        } catch (error) {
            healthData.services.email = 'unhealthy';
            healthData.status = 'degraded';
        }

        // Test reCAPTCHA (basic check)
        healthData.services.recaptcha = securityConfig.recaptcha.secretKey ? 'configured' : 'not_configured';

        SecurityLogger.logHealthCheck('contact_system', healthData.status, healthData);

        const statusCode = healthData.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(healthData);

    } catch (error) {
        logger.error('Contact health check failed', { error: error.message });
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get contact statistics (admin endpoint - should be protected in production)
router.get('/stats', async (req, res) => {
    try {
        SecurityLogger.logSecurityEvent('stats_requested', req);

        const [recentContacts, securityStats] = await Promise.all([
            database.getRecentContacts(24),
            database.getSecurityStats(24)
        ]);

        const stats = {
            contacts: {
                last24Hours: recentContacts.length,
                pending: recentContacts.filter(c => c.status === 'pending').length,
                contacted: recentContacts.filter(c => c.status === 'contacted').length,
                resolved: recentContacts.filter(c => c.status === 'resolved').length,
                spam: recentContacts.filter(c => c.status === 'spam').length
            },
            security: {
                events: securityStats,
                recaptchaStats: {
                    averageScore: recentContacts.reduce((sum, c) => sum + (c.recaptcha_score || 0), 0) / Math.max(recentContacts.length, 1),
                    lowScoreCount: recentContacts.filter(c => c.recaptcha_score < 0.5).length
                }
            },
            performance: {
                rateLimiterStats: rateLimiterService.getSecurityStats ? rateLimiterService.getSecurityStats() : {},
                validatorStats: inputValidator.getValidationSummary()
            },
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            stats,
            period: 'last 24 hours'
        });

    } catch (error) {
        logger.error('Error getting contact stats', { error: error.message });
        res.status(500).json({
            error: 'Error de estadísticas',
            message: 'No se pudieron obtener las estadísticas',
            code: 'STATS_ERROR'
        });
    }
});

// List contacts endpoint (admin only)
router.get('/list', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const status = req.query.status;
        
        let query = `
            SELECT * FROM contacts 
            ${status ? 'WHERE status = ?' : ''}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `;
        
        const params = status ? [status, limit, offset] : [limit, offset];
        const contacts = await database.db.all(query, params);
        
        // También obtener el total para paginación
        const countQuery = `SELECT COUNT(*) as total FROM contacts ${status ? 'WHERE status = ?' : ''}`;
        const countParams = status ? [status] : [];
        const countResult = await database.db.all(countQuery, countParams);
        const total = countResult[0].total;
        
        res.json({
            success: true,
            contacts,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Error listing contacts', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Error obteniendo contactos',
            message: error.message
        });
    }
});

module.exports = router;