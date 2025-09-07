#!/usr/bin/env node

require('dotenv').config();

const { database } = require('./backend/utils/db');

async function testDatabase() {
    try {
        console.log('Initializing database...');
        await database.initialize();
        console.log('Database initialized successfully!');
        
        console.log('Running health check...');
        const health = await database.healthCheck();
        console.log('Database health:', health);
        
        console.log('Closing database...');
        await database.close();
        console.log('Database closed successfully!');
        
    } catch (error) {
        console.error('Database test failed:', error);
        process.exit(1);
    }
}

testDatabase();