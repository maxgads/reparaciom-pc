const nodemailer = require('nodemailer');
const { logger, SecurityLogger } = require('./logger');

require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
        this.initialize();
    }

    async initialize() {
        try {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            await this.transporter.verify();
            this.isConfigured = true;
            logger.info('Email service initialized successfully');
        } catch (error) {
            logger.error('Email service initialization failed', { error: error.message });
            this.isConfigured = false;
        }
    }

    generateClientConfirmationHTML(contactData) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirmación de Consulta - Servicio de Reparación PC</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    margin: 0;
                    padding: 0;
                    background-color: #f5f5f5;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #ffffff;
                    border-radius: 10px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    margin-top: 20px;
                    margin-bottom: 20px;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                    margin: -20px -20px 20px -20px;
                }
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                }
                .content {
                    padding: 20px 0;
                }
                .info-box {
                    background-color: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #007bff;
                }
                .next-steps {
                    background-color: #e7f3ff;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .contact-info {
                    background-color: #f0f8f0;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .footer {
                    text-align: center;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    color: #666;
                    font-size: 14px;
                }
                .whatsapp-button {
                    display: inline-block;
                    background-color: #25D366;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 25px;
                    margin: 10px 0;
                    font-weight: bold;
                }
                .highlight {
                    color: #007bff;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>¡Consulta Recibida!</h1>
                    <p>Gracias por confiar en nuestro servicio</p>
                </div>
                
                <div class="content">
                    <p>Hola <strong>${contactData.name}</strong>,</p>
                    
                    <p>Hemos recibido tu consulta sobre tu <span class="highlight">${contactData.equipment_type}</span> y queremos agradecerte por contactarnos.</p>
                    
                    <div class="info-box">
                        <h3>📋 Resumen de tu consulta:</h3>
                        <p><strong>Equipo:</strong> ${contactData.equipment_type}</p>
                        <p><strong>Problema:</strong> ${contactData.problem_description}</p>
                        <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</p>
                    </div>
                    
                    <div class="next-steps">
                        <h3>📞 Próximos pasos:</h3>
                        <ol>
                            <li><strong>Revisión técnica:</strong> Analizaré tu consulta en detalle</li>
                            <li><strong>Presupuesto:</strong> Te contactaré en las próximas 2-4 horas con un presupuesto estimado</li>
                            <li><strong>Coordinación:</strong> Acordaremos el mejor momento para revisar tu equipo</li>
                        </ol>
                        
                        <p><strong>🕐 Tiempo de respuesta estimado:</strong> 2-4 horas en horario comercial</p>
                    </div>
                    
                    <div class="contact-info">
                        <h3>📱 ¿Necesitas una respuesta más rápida?</h3>
                        <p>También puedes contactarme directamente por WhatsApp:</p>
                        <a href="https://wa.me/${process.env.WHATSAPP_NUMBER}?text=Hola! Vi tu página web y necesito ayuda con mi ${contactData.equipment_type}" class="whatsapp-button">
                            💬 Escribir por WhatsApp
                        </a>
                        
                        <p><strong>Horarios de atención:</strong><br>
                        Lunes a Viernes: 9:00 - 18:00<br>
                        Sábados: 9:00 - 14:00</p>
                    </div>
                    
                    <div class="info-box">
                        <h3>🔧 Mientras tanto...</h3>
                        <p>Te recomiendo que:</p>
                        <ul>
                            <li>No intentes realizar reparaciones por tu cuenta</li>
                            <li>Mantén el equipo apagado si presenta fallas serias</li>
                            <li>Ten listos los cables y cargadores originales</li>
                            <li>Realiza un backup de datos importantes (si es posible)</li>
                        </ul>
                    </div>
                    
                    <p>Gracias nuevamente por tu confianza. Me pondré en contacto contigo muy pronto.</p>
                    
                    <p>Saludos cordiales,<br>
                    <strong>Servicio Técnico de Reparación PC</strong></p>
                </div>
                
                <div class="footer">
                    <p>Este es un mensaje automático de confirmación.<br>
                    Por favor, no respondas directamente a este correo.</p>
                    
                    <p>Servicio de Reparación PC - ${process.env.DOMAIN}<br>
                    WhatsApp: ${process.env.WHATSAPP_NUMBER}</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    generateTechnicianNotificationHTML(contactData) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nueva Consulta - Servicio de Reparación PC</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    border-radius: 10px;
                    box-shadow: 0 0 15px rgba(0,0,0,0.1);
                }
                .header {
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                    color: white;
                    padding: 25px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }
                .urgent {
                    background: #e74c3c;
                    color: white;
                    padding: 10px;
                    text-align: center;
                    font-weight: bold;
                }
                .content {
                    padding: 30px;
                }
                .client-info {
                    background-color: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 5px solid #007bff;
                }
                .security-info {
                    background-color: #fff3cd;
                    border: 1px solid #ffeaa7;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .problem-info {
                    background-color: #f0f8f0;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .actions {
                    background-color: #e7f3ff;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .action-button {
                    display: inline-block;
                    background-color: #007bff;
                    color: white;
                    padding: 10px 20px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 5px;
                }
                .whatsapp-button {
                    background-color: #25D366;
                }
                .table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                }
                .table th, .table td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: left;
                }
                .table th {
                    background-color: #f2f2f2;
                }
                .score-good { color: #27ae60; font-weight: bold; }
                .score-warning { color: #f39c12; font-weight: bold; }
                .score-danger { color: #e74c3c; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="urgent">
                    🚨 NUEVA CONSULTA RECIBIDA - ACCIÓN REQUERIDA
                </div>
                
                <div class="header">
                    <h1>📧 Nueva Consulta de Cliente</h1>
                    <p>Recibida el ${new Date().toLocaleDateString('es-AR', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</p>
                </div>
                
                <div class="content">
                    <div class="client-info">
                        <h3>👤 Información del Cliente</h3>
                        <table class="table">
                            <tr><th>Nombre</th><td>${contactData.name}</td></tr>
                            <tr><th>Email</th><td><a href="mailto:${contactData.email}">${contactData.email}</a></td></tr>
                            <tr><th>Teléfono</th><td><a href="tel:${contactData.phone}">${contactData.phone}</a></td></tr>
                            <tr><th>Tipo de Equipo</th><td><strong>${contactData.equipment_type}</strong></td></tr>
                        </table>
                    </div>
                    
                    <div class="problem-info">
                        <h3>🔧 Descripción del Problema</h3>
                        <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
                            <p><strong>"${contactData.problem_description}"</strong></p>
                        </div>
                    </div>
                    
                    <div class="security-info">
                        <h3>🛡️ Información de Seguridad</h3>
                        <table class="table">
                            <tr><th>IP Address</th><td>${contactData.ip_address}</td></tr>
                            <tr><th>User Agent</th><td style="font-size: 12px;">${contactData.user_agent || 'No disponible'}</td></tr>
                            <tr>
                                <th>reCAPTCHA Score</th>
                                <td>
                                    <span class="${
                                        contactData.recaptcha_score >= 0.7 ? 'score-good' : 
                                        contactData.recaptcha_score >= 0.3 ? 'score-warning' : 'score-danger'
                                    }">
                                        ${contactData.recaptcha_score ? (contactData.recaptcha_score * 100).toFixed(1) + '%' : 'No disponible'}
                                    </span>
                                    ${contactData.recaptcha_score < 0.3 ? '⚠️ SOSPECHOSO' : 
                                      contactData.recaptcha_score < 0.7 ? '⚠️ REVISAR' : '✅ CONFIABLE'}
                                </td>
                            </tr>
                            <tr><th>Timestamp</th><td>${new Date().toISOString()}</td></tr>
                        </table>
                    </div>
                    
                    <div class="actions">
                        <h3>⚡ Acciones Recomendadas</h3>
                        <ol>
                            <li><strong>Revisar la consulta</strong> - Evaluar el problema descrito</li>
                            <li><strong>Verificar disponibilidad</strong> - Confirmar horarios disponibles</li>
                            <li><strong>Contactar al cliente</strong> - Responder en 2-4 horas máximo</li>
                            <li><strong>Preparar presupuesto</strong> - Estimar costos preliminares</li>
                        </ol>
                        
                        <p><strong>📞 Contactar Cliente:</strong></p>
                        
                        <a href="mailto:${contactData.email}?subject=Re: Consulta sobre ${contactData.equipment_type}&body=Hola ${contactData.name},%0A%0AGracias por contactarme. He revisado tu consulta sobre tu ${contactData.equipment_type}.%0A%0A" 
                           class="action-button">
                            📧 Responder por Email
                        </a>
                        
                        <a href="https://wa.me/${contactData.phone.replace(/[^\d+]/g, '')}?text=Hola ${contactData.name}! Recibí tu consulta sobre tu ${contactData.equipment_type}. Me pondré en contacto contigo para coordinar una revisión técnica." 
                           class="action-button whatsapp-button">
                            💬 WhatsApp
                        </a>
                        
                        <a href="tel:${contactData.phone}" class="action-button" style="background-color: #2ecc71;">
                            📞 Llamar
                        </a>
                    </div>
                    
                    ${contactData.recaptcha_score < 0.3 ? `
                    <div class="security-info" style="background-color: #ffebee; border-color: #f44336;">
                        <h3>⚠️ ALERTA DE SEGURIDAD</h3>
                        <p><strong>Esta consulta tiene un score de reCAPTCHA bajo (${(contactData.recaptcha_score * 100).toFixed(1)}%)</strong></p>
                        <p>Recomendaciones:</p>
                        <ul>
                            <li>Verificar la legitimidad antes de responder</li>
                            <li>No proporcionar información sensible inicialmente</li>
                            <li>Considerar contacto telefónico para verificación</li>
                        </ul>
                    </div>
                    ` : ''}
                </div>
            </div>
        </body>
        </html>
        `;
    }

    async sendClientConfirmation(contactData) {
        if (!this.isConfigured) {
            throw new Error('Email service not properly configured');
        }

        const subject = `✅ Confirmación de consulta - ${contactData.equipment_type}`;
        const html = this.generateClientConfirmationHTML(contactData);

        const mailOptions = {
            from: {
                name: process.env.EMAIL_FROM_NAME || 'Servicio de Reparación PC',
                address: process.env.EMAIL_USER
            },
            to: contactData.email,
            subject: subject,
            html: html,
            priority: 'normal',
            headers: {
                'X-Priority': '3',
                'X-MSMail-Priority': 'Normal'
            }
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            SecurityLogger.logEmailSent(contactData.email, subject, 'success');
            logger.info('Client confirmation email sent', { 
                to: contactData.email, 
                messageId: result.messageId 
            });
            return result;
        } catch (error) {
            SecurityLogger.logEmailSent(contactData.email, subject, 'failed');
            logger.error('Failed to send client confirmation email', { 
                error: error.message,
                to: contactData.email
            });
            throw error;
        }
    }

    async sendTechnicianNotification(contactData) {
        if (!this.isConfigured) {
            throw new Error('Email service not properly configured');
        }

        const urgencyLevel = contactData.recaptcha_score < 0.3 ? '🚨 URGENTE - REVISAR: ' : '';
        const subject = `${urgencyLevel}Nueva consulta: ${contactData.equipment_type} - ${contactData.name}`;
        const html = this.generateTechnicianNotificationHTML(contactData);

        const mailOptions = {
            from: {
                name: 'Sistema de Contacto',
                address: process.env.EMAIL_USER
            },
            to: process.env.EMAIL_TO,
            subject: subject,
            html: html,
            priority: contactData.recaptcha_score < 0.3 ? 'high' : 'normal',
            headers: {
                'X-Priority': contactData.recaptcha_score < 0.3 ? '1' : '3',
                'X-MSMail-Priority': contactData.recaptcha_score < 0.3 ? 'High' : 'Normal'
            }
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            SecurityLogger.logEmailSent(process.env.EMAIL_TO, subject, 'success');
            logger.info('Technician notification email sent', { 
                messageId: result.messageId,
                clientName: contactData.name
            });
            return result;
        } catch (error) {
            SecurityLogger.logEmailSent(process.env.EMAIL_TO, subject, 'failed');
            logger.error('Failed to send technician notification email', { 
                error: error.message,
                clientName: contactData.name
            });
            throw error;
        }
    }

    async sendBothEmails(contactData) {
        const results = await Promise.allSettled([
            this.sendClientConfirmation(contactData),
            this.sendTechnicianNotification(contactData)
        ]);

        const clientResult = results[0];
        const techResult = results[1];

        return {
            clientEmail: clientResult.status === 'fulfilled' ? 'sent' : 'failed',
            techEmail: techResult.status === 'fulfilled' ? 'sent' : 'failed',
            errors: [
                ...(clientResult.status === 'rejected' ? [clientResult.reason] : []),
                ...(techResult.status === 'rejected' ? [techResult.reason] : [])
            ]
        };
    }

    async testConnection() {
        try {
            await this.transporter.verify();
            return { status: 'success', message: 'Email service is working correctly' };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }
}

const emailService = new EmailService();

module.exports = {
    EmailService,
    emailService
};