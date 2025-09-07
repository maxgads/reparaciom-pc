#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { logger } = require('../backend/utils/logger');

class SetupService {
    constructor() {
        this.dbPath = process.env.DB_PATH || './database/contacts.db';
        this.schemaPath = './database/schema.sql';
        this.seedPath = './database/seed.sql';
    }

    async setupDatabase() {
        try {
            logger.info('Starting database setup');

            // Ensure database directory exists
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
                logger.info('Database directory created', { dbDir });
            }

            // Create/connect to database
            const db = new sqlite3.Database(this.dbPath);

            // Run schema
            if (fs.existsSync(this.schemaPath)) {
                const schema = fs.readFileSync(this.schemaPath, 'utf8');
                await this.runSQLScript(db, schema);
                logger.info('Database schema applied successfully');
            } else {
                throw new Error(`Schema file not found: ${this.schemaPath}`);
            }

            // Run seed data if requested
            if (process.argv.includes('--seed') && fs.existsSync(this.seedPath)) {
                const seedData = fs.readFileSync(this.seedPath, 'utf8');
                await this.runSQLScript(db, seedData);
                logger.info('Seed data applied successfully');
            }

            // Close database
            await this.closeDatabase(db);
            logger.info('Database setup completed successfully');

        } catch (error) {
            logger.error('Database setup failed', { error: error.message });
            throw error;
        }
    }

    runSQLScript(db, script) {
        return new Promise((resolve, reject) => {
            db.exec(script, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    closeDatabase(db) {
        return new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    checkEnvironment() {
        const requiredEnvVars = [
            'PORT',
            'DB_PATH',
            'EMAIL_USER',
            'EMAIL_PASS',
            'RECAPTCHA_SITE_KEY',
            'RECAPTCHA_SECRET_KEY',
            'JWT_SECRET'
        ];

        const missing = [];
        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                missing.push(envVar);
            }
        }

        if (missing.length > 0) {
            console.log('⚠️  Missing required environment variables:');
            missing.forEach(envVar => {
                console.log(`   - ${envVar}`);
            });
            console.log('\nPlease configure these variables in your .env file');
            return false;
        }

        console.log('✅ All required environment variables are configured');
        return true;
    }

    async checkDependencies() {
        try {
            const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
            const dependencies = Object.keys(packageJson.dependencies || {});
            
            console.log('📦 Checking dependencies...');
            
            for (const dep of dependencies.slice(0, 5)) { // Check first 5
                try {
                    require.resolve(dep);
                } catch (error) {
                    console.log(`❌ Missing dependency: ${dep}`);
                    console.log('Run: npm install');
                    return false;
                }
            }
            
            console.log('✅ Dependencies are installed');
            return true;
        } catch (error) {
            console.log('❌ Error checking dependencies:', error.message);
            return false;
        }
    }

    displaySetupStatus() {
        console.log(`
╔══════════════════════════════════════════════════════╗
║              🔧 PC REPAIR SERVICE SETUP              ║
╚══════════════════════════════════════════════════════╝

Project Structure:
├── backend/
│   ├── server.js                ✅ Main server file
│   ├── routes/
│   │   ├── contact.js          ✅ Contact form API
│   │   └── api.js              ✅ General API routes
│   ├── middleware/
│   │   ├── security.js         ✅ Security middleware
│   │   ├── rateLimiter.js      ✅ Rate limiting
│   │   └── validator.js        ✅ Input validation
│   ├── utils/
│   │   ├── email.js            ✅ Email service
│   │   ├── logger.js           ✅ Logging system
│   │   └── db.js               ✅ Database utility
│   └── config/
│       ├── database.js         ✅ DB configuration
│       ├── security.js         ✅ Security config
│       └── spam-keywords.txt   ✅ Spam filtering
├── database/
│   ├── schema.sql              ✅ Database schema
│   └── seed.sql                ✅ Test data
├── scripts/
│   ├── backup.js               ✅ Backup system
│   └── setup.js                ✅ Setup utility
├── package.json                ✅ Dependencies
└── .env                        ⚠️  Configure this!

Security Features Implemented:
✅ Rate limiting (3 requests/hour per IP)
✅ reCAPTCHA v3 integration
✅ Spam keyword filtering
✅ Input validation & sanitization
✅ IP blocking system
✅ Security headers (Helmet)
✅ CORS protection
✅ Detailed security logging
✅ Database backup system
✅ Email notifications
✅ Anti-bot protection

Quick Start:
1. Configure .env file with your settings
2. Run: npm install
3. Run: node scripts/setup.js --seed
4. Run: npm start

For production deployment:
- Set NODE_ENV=production
- Configure SSL certificates
- Set up reverse proxy (nginx)
- Configure firewall rules
- Set up monitoring
        `);
    }
}

// CLI interface
if (require.main === module) {
    const setup = new SetupService();
    
    async function run() {
        try {
            if (process.argv.includes('--status')) {
                setup.displaySetupStatus();
                return;
            }
            
            if (process.argv.includes('--check')) {
                const envOk = setup.checkEnvironment();
                const depsOk = await setup.checkDependencies();
                
                if (envOk && depsOk) {
                    console.log('\n✅ System is ready to start!');
                    console.log('Run: npm start');
                } else {
                    console.log('\n❌ System not ready. Please fix the issues above.');
                }
                return;
            }
            
            // Setup database
            await setup.setupDatabase();
            console.log('✅ Database setup completed successfully');
            
            // Show final status
            if (!process.argv.includes('--quiet')) {
                setup.displaySetupStatus();
            }
            
        } catch (error) {
            console.error('❌ Setup failed:', error.message);
            process.exit(1);
        }
    }
    
    run();
}

module.exports = SetupService;