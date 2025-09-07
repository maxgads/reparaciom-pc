#!/usr/bin/env node

require('dotenv').config();

console.log('Testing security middleware...');

try {
    console.log('Loading security middleware...');
    const { securityMiddleware } = require('./backend/middleware/security');
    console.log('Security middleware loaded OK');
    
    console.log('Loading rate limiter...');  
    const { rateLimiterService } = require('./backend/middleware/rateLimiter');
    console.log('Rate limiter loaded OK');
    
    console.log('Testing email service...');
    const { emailService } = require('./backend/utils/email');
    console.log('Email service loaded OK');
    
    console.log('All middleware tests passed!');
} catch (error) {
    console.error('Middleware test failed:', error);
    process.exit(1);
}