#!/usr/bin/env node

require('dotenv').config();

const express = require('express');
const path = require('path');
const { logger } = require('./backend/utils/logger');
const { database } = require('./backend/utils/db');

const app = express();
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        console.log('Initializing database...');
        await database.initialize();
        console.log('Database initialized');

        console.log('Setting up middleware...');
        app.use(express.json());
        
        console.log('Loading contact routes...');
        const contactRoutes = require('./backend/routes/contact');
        app.use('/api/contact', contactRoutes);
        
        console.log('Starting server...');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
        
    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
}

startServer();