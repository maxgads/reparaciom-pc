const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const validator = require('validator');
const Filter = require('bad-words');
const fs = require('fs');
const path = require('path');
const { SecurityLogger } = require('../utils/logger');
const { database } = require('../utils/db');
const { securityConfig } = require('../config/security');

class InputValidator {
    constructor() {
        this.profanityFilter = new Filter();
        this.spamKeywords = [];
        this.loadSpamKeywords();
        
        this.profanityFilter.addWords('idiota', 'estupido', 'imbecil', 'tarado');
    }

    loadSpamKeywords() {
        try {
            const keywordsPath = path.join(__dirname, '../config/spam-keywords.txt');
            if (fs.existsSync(keywordsPath)) {
                const content = fs.readFileSync(keywordsPath, 'utf8');
                this.spamKeywords = content
                    .split('\n')
                    .map(line => line.trim().toLowerCase())
                    .filter(line => line && !line.startsWith('#'));
            }
        } catch (error) {
            console.error('Error loading spam keywords:', error);
        }
    }

    getContactValidationRules() {
        return [
            body('name')
                .trim()
                .isLength({ 
                    min: securityConfig.validation.minInputLength.name, 
                    max: securityConfig.validation.maxInputLength.name 
                })
                .withMessage(`El nombre debe tener entre ${securityConfig.validation.minInputLength.name} y ${securityConfig.validation.maxInputLength.name} caracteres`)
                .matches(securityConfig.validation.patterns.name)
                .withMessage('El nombre solo puede contener letras, espacios, apostrofes y guiones')
                .customSanitizer(value => {
                    return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
                }),

            body('email')
                .trim()
                .isLength({ 
                    min: securityConfig.validation.minInputLength.email, 
                    max: securityConfig.validation.maxInputLength.email 
                })
                .withMessage(`El email debe tener entre ${securityConfig.validation.minInputLength.email} y ${securityConfig.validation.maxInputLength.email} caracteres`)
                .isEmail()
                .withMessage('Debe proporcionar un email válido')
                .matches(securityConfig.validation.patterns.email)
                .withMessage('Formato de email inválido')
                .normalizeEmail()
                .customSanitizer(value => {
                    return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
                }),

            body('phone')
                .trim()
                .isLength({ 
                    min: securityConfig.validation.minInputLength.phone, 
                    max: securityConfig.validation.maxInputLength.phone 
                })
                .withMessage(`El teléfono debe tener entre ${securityConfig.validation.minInputLength.phone} y ${securityConfig.validation.maxInputLength.phone} caracteres`)
                .matches(securityConfig.validation.patterns.phone)
                .withMessage('El teléfono solo puede contener números, espacios, guiones, paréntesis y el signo +')
                .customSanitizer(value => {
                    return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
                }),

            body('equipment_type')
                .trim()
                .isLength({ 
                    min: 2, 
                    max: securityConfig.validation.maxInputLength.equipmentType 
                })
                .withMessage(`El tipo de equipo debe tener entre 2 y ${securityConfig.validation.maxInputLength.equipmentType} caracteres`)
                .isIn(['PC', 'Notebook', 'Netbook', 'All-in-One', 'Gaming PC', 'Workstation', 'Otro'])
                .withMessage('Debe seleccionar un tipo de equipo válido')
                .customSanitizer(value => {
                    return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
                }),

            body('problem_description')
                .trim()
                .isLength({ 
                    min: securityConfig.validation.minInputLength.problemDescription, 
                    max: securityConfig.validation.maxInputLength.problemDescription 
                })
                .withMessage(`La descripción debe tener entre ${securityConfig.validation.minInputLength.problemDescription} y ${securityConfig.validation.maxInputLength.problemDescription} caracteres`)
                .customSanitizer(value => {
                    return sanitizeHtml(value, { 
                        allowedTags: [], 
                        allowedAttributes: {},
                        textFilter: (text) => {
                            return text.replace(/[<>]/g, '');
                        }
                    });
                }),

            body('recaptcha_token')
                .notEmpty()
                .withMessage('Token de reCAPTCHA requerido')
                .isLength({ min: 20, max: 2000 })
                .withMessage('Token de reCAPTCHA inválido')
        ];
    }

    async validateContactInput() {
        return async (req, res, next) => {
            const errors = validationResult(req);
            
            if (!errors.isEmpty()) {
                const ip = req.ip || req.connection.remoteAddress;
                const validationErrors = errors.array();
                
                for (const error of validationErrors) {
                    SecurityLogger.logValidationError(req, error.param, error.value, error.msg);
                    
                    await database.logSecurityEvent({
                        event_type: 'validation_failed',
                        ip_address: ip,
                        user_agent: req.get('User-Agent'),
                        request_data: {
                            field: error.param,
                            error: error.msg,
                            value: typeof error.value === 'string' ? error.value.substring(0, 100) : error.value
                        },
                        blocked: false,
                        severity: 'warning',
                        details: `Input validation failed for field: ${error.param}`
                    });
                }

                return res.status(400).json({
                    error: 'Datos inválidos',
                    message: 'Por favor corrige los errores en el formulario',
                    details: validationErrors.map(err => ({
                        field: err.param,
                        message: err.msg,
                        value: err.value
                    })),
                    code: 'VALIDATION_ERROR'
                });
            }

            next();
        };
    }

    async checkSpamContent() {
        return async (req, res, next) => {
            const ip = req.ip || req.connection.remoteAddress;
            const { name, email, problem_description } = req.body;
            
            try {
                const spamResults = await this.analyzeForSpam({
                    name,
                    email,
                    problem_description
                });

                if (spamResults.isSpam) {
                    SecurityLogger.logSpamDetection(req, spamResults.reasons.join(', '), {
                        spamScore: spamResults.score,
                        reasons: spamResults.reasons,
                        triggeredKeywords: spamResults.triggeredKeywords
                    });

                    await database.logSecurityEvent({
                        event_type: 'spam_detected',
                        ip_address: ip,
                        user_agent: req.get('User-Agent'),
                        request_data: {
                            name: name.substring(0, 50),
                            email: email,
                            reasons: spamResults.reasons,
                            score: spamResults.score
                        },
                        blocked: true,
                        severity: 'warning',
                        details: `Spam detected: ${spamResults.reasons.join(', ')}`
                    });

                    await this.handleSpamDetection(ip, req);

                    return res.status(403).json({
                        error: 'Contenido no permitido',
                        message: 'Tu mensaje ha sido identificado como spam o contiene contenido no permitido.',
                        code: 'SPAM_DETECTED'
                    });
                }

                req.spamAnalysis = spamResults;
                next();

            } catch (error) {
                console.error('Error checking spam content:', error);
                next(); // Continue on error to avoid blocking legitimate users
            }
        };
    }

    async analyzeForSpam(data) {
        const { name, email, problem_description } = data;
        const fullText = `${name} ${problem_description}`.toLowerCase();
        
        let spamScore = 0;
        const reasons = [];
        const triggeredKeywords = [];

        // Check spam keywords
        for (const keyword of this.spamKeywords) {
            if (fullText.includes(keyword)) {
                spamScore += 25;
                reasons.push(`Spam keyword: ${keyword}`);
                triggeredKeywords.push(keyword);
            }
        }

        // Check profanity
        if (securityConfig.antiSpam.profanityFilterEnabled) {
            if (this.profanityFilter.isProfane(fullText)) {
                spamScore += 20;
                reasons.push('Profanity detected');
            }
        }

        // Check suspicious patterns
        for (const pattern of securityConfig.antiSpam.suspiciousPatterns) {
            if (pattern.test(fullText)) {
                spamScore += 15;
                reasons.push(`Suspicious pattern: ${pattern.toString()}`);
            }
        }

        // Check for URLs
        const urlMatches = fullText.match(/https?:\/\/[^\s]+/gi) || [];
        if (urlMatches.length > securityConfig.antiSpam.maxUrlsAllowed) {
            spamScore += 30;
            reasons.push(`Too many URLs (${urlMatches.length})`);
        }

        // Check capital letters percentage
        const totalLetters = fullText.replace(/[^a-zA-Z]/g, '').length;
        const capitalLetters = fullText.replace(/[^A-Z]/g, '').length;
        const capitalPercentage = totalLetters > 0 ? (capitalLetters / totalLetters) * 100 : 0;
        
        if (capitalPercentage > securityConfig.antiSpam.maxCapitalPercentage) {
            spamScore += 20;
            reasons.push(`Too many capital letters (${capitalPercentage.toFixed(1)}%)`);
        }

        // Check for fake/suspicious emails
        if (securityConfig.antiSpam.detectFakeEmails) {
            const suspiciousEmailPatterns = [
                /@(10minutemail|guerrillamail|mailinator|tempmail|yopmail)/i,
                /@[0-9]+\.(com|net|org)/,
                /@(test|fake|spam|example)\./i
            ];

            for (const pattern of suspiciousEmailPatterns) {
                if (pattern.test(email)) {
                    spamScore += 25;
                    reasons.push('Suspicious email provider');
                    break;
                }
            }
        }

        // Check message length patterns
        if (problem_description.length < 20) {
            spamScore += 10;
            reasons.push('Message too short');
        }

        // Check for repeated characters/patterns
        const repeatedChars = problem_description.match(/(.)\1{4,}/g);
        if (repeatedChars && repeatedChars.length > 0) {
            spamScore += 15;
            reasons.push('Repeated characters detected');
        }

        // Check grammar and coherence (basic check)
        const words = problem_description.split(/\s+/);
        const uniqueWords = new Set(words.map(w => w.toLowerCase()));
        const wordRepetitionRatio = words.length > 0 ? uniqueWords.size / words.length : 1;
        
        if (wordRepetitionRatio < 0.3 && words.length > 10) {
            spamScore += 20;
            reasons.push('High word repetition');
        }

        return {
            isSpam: spamScore >= 50, // Spam threshold
            score: spamScore,
            reasons,
            triggeredKeywords,
            analysis: {
                capitalPercentage,
                urlCount: urlMatches.length,
                wordRepetitionRatio,
                messageLength: problem_description.length
            }
        };
    }

    async handleSpamDetection(ip, req) {
        try {
            // Increment spam counter for this IP
            const recentSpam = await database.db.get(
                'SELECT COUNT(*) as count FROM security_logs WHERE ip_address = ? AND event_type = "spam_detected" AND created_at > datetime("now", "-1 hour")',
                [ip]
            );

            if (recentSpam && recentSpam.count >= 3) {
                await database.blockIP(
                    ip,
                    `Multiple spam attempts (${recentSpam.count + 1} in last hour)`,
                    24, // 24 hours block
                    false
                );

                SecurityLogger.logSuspiciousActivity(req, 'automatic_spam_blocking', {
                    spamCount: recentSpam.count + 1,
                    blockDuration: '24 hours'
                });
            }
        } catch (error) {
            console.error('Error handling spam detection:', error);
        }
    }

    async validateEmail(email) {
        try {
            if (!validator.isEmail(email)) {
                return { valid: false, reason: 'Invalid email format' };
            }

            const domain = email.split('@')[1];
            if (!domain) {
                return { valid: false, reason: 'Invalid email domain' };
            }

            // Basic domain validation
            const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com'];
            const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/;
            
            if (!domainPattern.test(domain)) {
                return { valid: false, reason: 'Invalid domain format' };
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, reason: 'Email validation error' };
        }
    }

    async validatePhoneNumber(phone) {
        try {
            const cleanPhone = phone.replace(/[^\d+]/g, '');
            
            if (cleanPhone.length < 8 || cleanPhone.length > 15) {
                return { valid: false, reason: 'Invalid phone number length' };
            }

            if (cleanPhone.startsWith('+')) {
                if (cleanPhone.length < 10) {
                    return { valid: false, reason: 'Invalid international phone number' };
                }
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, reason: 'Phone validation error' };
        }
    }

    sanitizeInput(input, type = 'text') {
        if (typeof input !== 'string') {
            return input;
        }

        switch (type) {
            case 'html':
                return sanitizeHtml(input, {
                    allowedTags: [],
                    allowedAttributes: {},
                    allowedSchemes: []
                });
            
            case 'sql':
                return input.replace(/['";\\]/g, '');
            
            case 'name':
                return input.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s'-]/g, '').trim();
            
            case 'phone':
                return input.replace(/[^\d\s\-\+\(\)]/g, '').trim();
            
            default:
                return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
        }
    }

    getValidationSummary() {
        return {
            spamKeywordsCount: this.spamKeywords.length,
            profanityFilterEnabled: securityConfig.antiSpam.profanityFilterEnabled,
            maxInputLengths: securityConfig.validation.maxInputLength,
            minInputLengths: securityConfig.validation.minInputLength,
            spamThreshold: 50,
            antiSpamFeatures: {
                keywordFiltering: true,
                profanityFiltering: securityConfig.antiSpam.profanityFilterEnabled,
                patternDetection: true,
                urlDetection: true,
                capitalLetterAnalysis: true,
                fakeEmailDetection: securityConfig.antiSpam.detectFakeEmails,
                grammarAnalysis: securityConfig.antiSpam.checkGrammar
            }
        };
    }
}

const inputValidator = new InputValidator();

module.exports = {
    InputValidator,
    inputValidator
};