#!/usr/bin/env node

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { logger, SecurityLogger } = require('./utils/logger');
const { database } = require('./utils/db');
const { emailService } = require('./utils/email');
const { securityMiddleware } = require('./middleware/security');
const { rateLimiterService } = require('./middleware/rateLimiter');

// Route imports
const contactRoutes = require('./routes/contact');
const apiRoutes = require('./routes/api');

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_PATH = path.join(__dirname, '../frontend');

class PCRepairServer {
    constructor() {
        this.app = express();
        this.server = null;
        this.isShuttingDown = false;
        
        this.initializeServer();
    }

    async initializeServer() {
        try {
            // Initialize database
            await this.initializeDatabase();
            
            // Setup middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();
            
            // Setup error handling
            this.setupErrorHandling();
            
            // Start server
            await this.startServer();
            
            // Setup graceful shutdown
            this.setupGracefulShutdown();
            
        } catch (error) {
            logger.error('Server initialization failed', { error: error.message, stack: error.stack });
            process.exit(1);
        }
    }

    async initializeDatabase() {
        try {
            await database.initialize();
            logger.info('Database initialized successfully');
            
            // Run initial cleanup
            await database.cleanupOldRecords();
            logger.info('Initial database cleanup completed');
            
            // Schedule periodic cleanup (every 6 hours)
            setInterval(async () => {
                try {
                    await database.cleanupOldRecords();
                    logger.info('Scheduled database cleanup completed');
                } catch (error) {
                    logger.error('Scheduled database cleanup failed', { error: error.message });
                }
            }, 6 * 60 * 60 * 1000);
            
        } catch (error) {
            logger.error('Database initialization failed', { error: error.message });
            throw error;
        }
    }

    setupMiddleware() {
        // Trust proxy (important for getting real IP addresses)
        this.app.set('trust proxy', NODE_ENV === 'production' ? 1 : false);
        
        // Request ID middleware
        this.app.use(securityMiddleware.requestId());
        
        // Security headers
        this.app.use(securityMiddleware.getHelmetConfig());
        
        // CORS
        this.app.use(securityMiddleware.getCorsConfig());
        
        // Compression
        this.app.use(securityMiddleware.getCompressionConfig());
        
        // Logging
        this.app.use(securityMiddleware.getLoggingConfig());
        
        // Global rate limiting
        this.app.use(rateLimiterService.createGlobalLimiter());
        
        // IP blocking check
        this.app.use(rateLimiterService.checkIPBlocking());
        
        // Security analysis
        this.app.use(securityMiddleware.securityAnalysis());
        
        // Response headers
        this.app.use(securityMiddleware.responseHeaderSecurity());
        
        // Parse JSON payloads
        this.app.use(express.json({ 
            limit: '10mb',
            strict: true,
            type: ['application/json', 'text/plain']
        }));
        
        // Parse URL-encoded payloads
        this.app.use(express.urlencoded({ 
            extended: true, 
            limit: '10mb' 
        }));
        
        logger.info('Middleware setup completed');
    }

    setupRoutes() {
        // Health check endpoint (before rate limiting)
        this.app.get('/health', securityMiddleware.healthCheck());
        
        // API routes
        this.app.use('/api', apiRoutes);
        this.app.use('/api/contact', contactRoutes);
        
        // Serve static frontend files
        if (fs.existsSync(FRONTEND_PATH)) {
            this.app.use(express.static(FRONTEND_PATH, {
                maxAge: NODE_ENV === 'production' ? '1y' : '0',
                etag: true,
                lastModified: true,
                setHeaders: (res, path) => {
                    // Security headers for static files
                    if (path.endsWith('.html')) {
                        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                        res.setHeader('X-Content-Type-Options', 'nosniff');
                        res.setHeader('X-Frame-Options', 'DENY');
                    }
                }
            }));
            
            // Admin route
            this.app.get('/admin', (req, res) => {
                const adminPath = path.join(FRONTEND_PATH, 'admin.html');
                if (fs.existsSync(adminPath)) {
                    SecurityLogger.logSecurityEvent('admin_page_accessed', req, {
                        userAgent: req.get('User-Agent'),
                        ip: req.ip
                    });
                    res.sendFile(adminPath);
                } else {
                    res.status(404).send('Admin page not found');
                }
            });
            
            // Serve index.html for all non-API routes (SPA fallback)
            this.app.get('*', (req, res, next) => {
                if (req.path.startsWith('/api') || req.path === '/admin') {
                    return next();
                }
                
                const indexPath = path.join(FRONTEND_PATH, 'index.html');
                if (fs.existsSync(indexPath)) {
                    SecurityLogger.logSecurityEvent('frontend_page_served', req, {
                        requestedPath: req.path
                    });
                    res.sendFile(indexPath);
                } else {
                    next();
                }
            });
            
            logger.info('Frontend static files configured', { frontendPath: FRONTEND_PATH });
        } else {
            logger.warn('Frontend directory not found', { frontendPath: FRONTEND_PATH });
        }
        
        logger.info('Routes setup completed');
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use(securityMiddleware.notFoundHandler());
        
        // Global error handler
        this.app.use(securityMiddleware.errorHandler());
        
        // Unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Promise Rejection', {
                reason: reason?.message || reason,
                stack: reason?.stack,
                promise: promise.toString()
            });
            
            if (NODE_ENV === 'production') {
                this.gracefulShutdown('Unhandled Promise Rejection');
            }
        });
        
        // Uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', {
                error: error.message,
                stack: error.stack
            });
            
            this.gracefulShutdown('Uncaught Exception');
        });
        
        logger.info('Error handling setup completed');
    }

    async startServer() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(PORT, HOST, (error) => {
                if (error) {
                    logger.error('Server failed to start', { error: error.message, port: PORT, host: HOST });
                    return reject(error);
                }
                
                SecurityLogger.logServerStart();
                logger.info('🚀 PC Repair Service server started successfully', {
                    port: PORT,
                    host: HOST,
                    environment: NODE_ENV,
                    processId: process.pid,
                    nodeVersion: process.version,
                    timestamp: new Date().toISOString()
                });
                
                console.log(`
╔════════════════════════════════════════════════════╗
║         🔧 PC REPAIR SERVICE - SERVER ONLINE       ║
╠════════════════════════════════════════════════════╣
║  Port:        ${PORT.toString().padEnd(38)} ║
║  Host:        ${HOST.padEnd(38)} ║
║  Environment: ${NODE_ENV.padEnd(38)} ║
║  Frontend:    ${fs.existsSync(FRONTEND_PATH) ? 'Available'.padEnd(38) : 'Not Available'.padEnd(38)} ║
║  Database:    Connected${' '.repeat(30)} ║
║  Security:    Active${' '.repeat(33)} ║
╠════════════════════════════════════════════════════╣
║  Health:      http://${HOST}:${PORT}/health${' '.repeat(Math.max(0, 20 - HOST.length - PORT.toString().length))} ║
║  API:         http://${HOST}:${PORT}/api${' '.repeat(Math.max(0, 22 - HOST.length - PORT.toString().length))} ║
║  Contact:     http://${HOST}:${PORT}/api/contact${' '.repeat(Math.max(0, 14 - HOST.length - PORT.toString().length))} ║
╚════════════════════════════════════════════════════╝
                `);
                
                resolve();
            });
            
            this.server.on('error', (error) => {
                logger.error('Server error', { error: error.message });
                reject(error);
            });
        });
    }

    setupGracefulShutdown() {
        const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
        
        shutdownSignals.forEach(signal => {
            process.on(signal, () => {
                logger.info(`Received ${signal}, starting graceful shutdown`);
                this.gracefulShutdown(signal);
            });
        });
    }

    async gracefulShutdown(signal) {
        if (this.isShuttingDown) {
            logger.warn('Shutdown already in progress, forcing exit');
            process.exit(1);
        }
        
        this.isShuttingDown = true;
        logger.info('Starting graceful shutdown', { signal });
        
        // Set a timeout for forced shutdown
        const forceShutdownTimer = setTimeout(() => {
            logger.error('Forced shutdown due to timeout');
            process.exit(1);
        }, 30000); // 30 seconds timeout
        
        try {
            // Stop accepting new requests
            if (this.server) {
                logger.info('Stopping HTTP server');
                await new Promise((resolve, reject) => {
                    this.server.close((error) => {
                        if (error) {
                            logger.error('Error closing HTTP server', { error: error.message });
                            reject(error);
                        } else {
                            logger.info('HTTP server closed');
                            resolve();
                        }
                    });
                });
            }
            
            // Close database connection
            if (database && database.isConnected) {
                logger.info('Closing database connection');
                await database.close();
                logger.info('Database connection closed');
            }
            
            // Final log entry
            SecurityLogger.logSecurityEvent('server_shutdown', { ip: 'localhost' }, {
                signal,
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
            
            logger.info('Graceful shutdown completed', { 
                signal,
                uptime: process.uptime()
            });
            
            clearTimeout(forceShutdownTimer);
            process.exit(0);
            
        } catch (error) {
            logger.error('Error during graceful shutdown', { 
                error: error.message,
                signal 
            });
            clearTimeout(forceShutdownTimer);
            process.exit(1);
        }
    }

    // Method to get server statistics
    getServerStats() {
        return {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            version: process.version,
            platform: process.platform,
            arch: process.arch,
            environment: NODE_ENV,
            port: PORT,
            pid: process.pid,
            started: new Date(Date.now() - process.uptime() * 1000).toISOString()
        };
    }
}

// Only start the server if this file is run directly
if (require.main === module) {
    new PCRepairServer();
}

module.exports = PCRepairServer;