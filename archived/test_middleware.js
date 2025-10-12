#!/usr/bin/env node

require('dotenv').config();

const { inputValidator } = require('./backend/middleware/validator');

async function testMiddleware() {
    try {
        console.log('Testing validateContactInput...');
        const validateMiddleware = await inputValidator.validateContactInput();
        console.log('validateContactInput OK:', typeof validateMiddleware);
        
        console.log('Testing checkSpamContent...');
        const spamMiddleware = await inputValidator.checkSpamContent();
        console.log('checkSpamContent OK:', typeof spamMiddleware);
        
        console.log('All middleware tests passed!');
    } catch (error) {
        console.error('Middleware test failed:', error);
        process.exit(1);
    }
}

testMiddleware();