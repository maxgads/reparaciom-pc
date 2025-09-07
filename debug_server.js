#!/usr/bin/env node

require('dotenv').config();

console.log('=== DEBUG SERVER START ===');

try {
    console.log('1. Loading express...');
    const express = require('express');
    
    console.log('2. Loading path...');
    const path = require('path');
    
    console.log('3. Loading utils...');
    const { logger } = require('./backend/utils/logger');
    
    console.log('4. Loading database...');
    const { database } = require('./backend/utils/db');
    
    console.log('5. Loading contact routes...');
    const contactRoutes = require('./backend/routes/contact');
    
    console.log('6. Creating express app...');
    const app = express();
    
    console.log('7. Setting up basic middleware...');
    app.use(express.json());
    
    console.log('8. Setting up routes...');
    app.use('/api/contact', contactRoutes);
    
    console.log('9. Starting server...');
    const server = app.listen(3001, () => {
        console.log('=== SERVER RUNNING ON PORT 3001 ===');
        setTimeout(() => {
            console.log('=== SHUTTING DOWN ===');
            server.close();
            process.exit(0);
        }, 2000);
    });
    
} catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
}