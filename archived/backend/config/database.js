require('dotenv').config();

const databaseConfig = {
    path: process.env.DB_PATH || './database/contacts.db',
    backupPath: process.env.DB_BACKUP_PATH || './backups/',
    retentionDays: parseInt(process.env.DB_BACKUP_RETENTION_DAYS) || 30,
    
    options: {
        busyTimeout: 5000,
        enableForeignKeys: true,
        journalMode: 'WAL',
        synchronous: 'NORMAL',
        cacheSize: 2000,
        tempStore: 'memory'
    },
    
    backup: {
        enabled: process.env.BACKUP_ENABLED === 'true',
        schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
        encrypt: process.env.BACKUP_ENCRYPT === 'true',
        encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
        compressionLevel: 6
    },
    
    maintenance: {
        vacuumSchedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
        analyzeSchedule: '0 4 * * 0', // Weekly on Sunday at 4 AM
        cleanupOldRecords: true,
        optimizeIndexes: true
    },
    
    monitoring: {
        enabled: true,
        slowQueryThreshold: 1000, // milliseconds
        logQueries: process.env.DEBUG_MODE === 'true',
        connectionPoolSize: 5
    }
};

module.exports = databaseConfig;