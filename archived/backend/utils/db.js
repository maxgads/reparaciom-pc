const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { logger, SecurityLogger } = require('./logger');

require('dotenv').config();

class Database {
    constructor() {
        this.dbPath = process.env.DB_PATH || './database/contacts.db';
        this.db = null;
        this.isConnected = false;
    }

    async initialize() {
        try {
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    SecurityLogger.logDatabaseConnection('failed', { error: err.message });
                    throw err;
                }
                
                this.isConnected = true;
                SecurityLogger.logDatabaseConnection('success', { dbPath: this.dbPath });
            });

            this.db.configure('busyTimeout', 5000);

            await this.createTables();
            await this.enableForeignKeys();
            
            return true;
        } catch (error) {
            logger.error('Database initialization failed', { error: error.message });
            throw error;
        }
    }

    async createTables() {
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found: ${schemaPath}`);
        }

        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        return new Promise((resolve, reject) => {
            this.db.exec(schema, (err) => {
                if (err) {
                    reject(err);
                } else {
                    logger.info('Database tables created successfully');
                    resolve();
                }
            });
        });
    }

    async enableForeignKeys() {
        return new Promise((resolve, reject) => {
            this.db.run('PRAGMA foreign_keys = ON;', (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async insertContact(contactData) {
        const query = `
            INSERT INTO contacts 
            (name, email, phone, equipment_type, problem_description, ip_address, user_agent, recaptcha_score, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        return new Promise((resolve, reject) => {
            this.db.run(
                query,
                [
                    contactData.name,
                    contactData.email,
                    contactData.phone,
                    contactData.equipment_type,
                    contactData.problem_description,
                    contactData.ip_address,
                    contactData.user_agent,
                    contactData.recaptcha_score,
                    contactData.status || 'pending'
                ],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, changes: this.changes });
                    }
                }
            );
        });
    }

    async logSecurityEvent(eventData) {
        const query = `
            INSERT INTO security_logs 
            (event_type, ip_address, user_agent, request_data, blocked, severity, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        return new Promise((resolve, reject) => {
            this.db.run(
                query,
                [
                    eventData.event_type,
                    eventData.ip_address,
                    eventData.user_agent,
                    eventData.request_data ? JSON.stringify(eventData.request_data) : null,
                    eventData.blocked ? 1 : 0,
                    eventData.severity || 'info',
                    eventData.details
                ],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, changes: this.changes });
                    }
                }
            );
        });
    }

    async blockIP(ipAddress, reason, duration = null, permanent = false) {
        const query = `
            INSERT OR REPLACE INTO blocked_ips 
            (ip_address, reason, blocked_until, permanent, blocked_count, created_at, updated_at)
            VALUES (
                ?, ?, 
                CASE WHEN ? IS NOT NULL THEN datetime('now', '+' || ? || ' hours') ELSE NULL END,
                ?, 
                COALESCE((SELECT blocked_count + 1 FROM blocked_ips WHERE ip_address = ?), 1),
                COALESCE((SELECT created_at FROM blocked_ips WHERE ip_address = ?), CURRENT_TIMESTAMP),
                CURRENT_TIMESTAMP
            )
        `;

        return new Promise((resolve, reject) => {
            this.db.run(
                query,
                [ipAddress, reason, duration, duration, permanent ? 1 : 0, ipAddress, ipAddress],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        SecurityLogger.logIPBlocked(ipAddress, reason, duration);
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    async isIPBlocked(ipAddress) {
        const query = `
            SELECT * FROM blocked_ips 
            WHERE ip_address = ? 
            AND (permanent = 1 OR blocked_until > CURRENT_TIMESTAMP)
        `;

        return new Promise((resolve, reject) => {
            this.db.get(query, [ipAddress], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async updateRateLimit(ipAddress, endpoint) {
        const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000; // 1 hour
        const windowStartTime = new Date(Date.now() - windowMs).toISOString();

        const query = `
            INSERT OR REPLACE INTO rate_limits 
            (ip_address, endpoint, request_count, window_start, last_request)
            VALUES (
                ?, ?, 
                CASE 
                    WHEN (SELECT window_start FROM rate_limits WHERE ip_address = ? AND endpoint = ? AND window_start > ?) 
                    THEN (SELECT request_count + 1 FROM rate_limits WHERE ip_address = ? AND endpoint = ?)
                    ELSE 1 
                END,
                CASE 
                    WHEN (SELECT window_start FROM rate_limits WHERE ip_address = ? AND endpoint = ? AND window_start > ?)
                    THEN (SELECT window_start FROM rate_limits WHERE ip_address = ? AND endpoint = ?)
                    ELSE CURRENT_TIMESTAMP 
                END,
                CURRENT_TIMESTAMP
            )
        `;

        return new Promise((resolve, reject) => {
            this.db.run(
                query,
                [ipAddress, endpoint, ipAddress, endpoint, windowStartTime, ipAddress, endpoint, 
                 ipAddress, endpoint, windowStartTime, ipAddress, endpoint],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    async getRateLimit(ipAddress, endpoint) {
        const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000;
        const windowStartTime = new Date(Date.now() - windowMs).toISOString();

        const query = `
            SELECT * FROM rate_limits 
            WHERE ip_address = ? AND endpoint = ? AND window_start > ?
        `;

        return new Promise((resolve, reject) => {
            this.db.get(query, [ipAddress, endpoint, windowStartTime], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getRecentContacts(hours = 24) {
        const query = `
            SELECT * FROM contacts 
            WHERE created_at > datetime('now', '-' || ? || ' hours')
            ORDER BY created_at DESC
        `;

        return new Promise((resolve, reject) => {
            this.db.all(query, [hours], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getSecurityStats(hours = 24) {
        const query = `
            SELECT 
                event_type,
                severity,
                COUNT(*) as count,
                COUNT(CASE WHEN blocked = 1 THEN 1 END) as blocked_count
            FROM security_logs 
            WHERE created_at > datetime('now', '-' || ? || ' hours')
            GROUP BY event_type, severity
            ORDER BY count DESC
        `;

        return new Promise((resolve, reject) => {
            this.db.all(query, [hours], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async cleanupOldRecords() {
        const retentionDays = process.env.DB_BACKUP_RETENTION_DAYS || 30;

        const queries = [
            `DELETE FROM security_logs WHERE created_at < datetime('now', '-${retentionDays} days')`,
            `DELETE FROM rate_limits WHERE window_start < datetime('now', '-7 days')`,
            `UPDATE blocked_ips SET blocked_until = NULL WHERE blocked_until < CURRENT_TIMESTAMP AND permanent = 0`
        ];

        for (const query of queries) {
            await new Promise((resolve, reject) => {
                this.db.run(query, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            });
        }

        logger.info('Database cleanup completed', { retentionDays });
    }

    async healthCheck() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT 1 as status', (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ healthy: true, status: 'connected' });
                }
            });
        });
    }

    async close() {
        if (this.db && this.isConnected) {
            return new Promise((resolve, reject) => {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.isConnected = false;
                        logger.info('Database connection closed');
                        resolve();
                    }
                });
            });
        }
    }
}

const database = new Database();

module.exports = {
    Database,
    database
};