#!/usr/bin/env node

require('dotenv').config();

console.log('Loading express...');
const express = require('express');

console.log('Loading contact routes...');
try {
    const contactRoutes = require('./backend/routes/contact');
    console.log('Contact routes loaded successfully');
} catch (error) {
    console.error('Error loading contact routes:', error);
    process.exit(1);
}

console.log('All imports successful!');