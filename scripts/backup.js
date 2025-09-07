#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { exec } = require('child_process');
const { promisify } = require('util');
const { logger, SecurityLogger } = require('../backend/utils/logger');

const execAsync = promisify(exec);

class BackupService {
    constructor() {
        this.backupDir = process.env.DB_BACKUP_PATH || './backups';
        this.dbPath = process.env.DB_PATH || './database/contacts.db';
        this.retentionDays = parseInt(process.env.DB_BACKUP_RETENTION_DAYS) || 30;
        this.encryptBackups = process.env.BACKUP_ENCRYPT === 'true';
        this.encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
        
        this.ensureBackupDirectory();
    }

    ensureBackupDirectory() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            logger.info('Backup directory created', { backupDir: this.backupDir });
        }
    }

    async createBackup(options = {}) {
        const startTime = Date.now();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = options.name || `backup-${timestamp}`;
        
        try {
            logger.info('Starting database backup', { backupName, dbPath: this.dbPath });
            
            // Check if database file exists
            if (!fs.existsSync(this.dbPath)) {
                throw new Error(`Database file not found: ${this.dbPath}`);
            }
            
            // Create backup info
            const backupInfo = {
                name: backupName,
                timestamp: new Date().toISOString(),
                originalSize: fs.statSync(this.dbPath).size,
                source: this.dbPath,
                type: options.type || 'scheduled',
                encrypted: this.encryptBackups,
                compressed: true
            };

            // Read original database file
            const originalData = fs.readFileSync(this.dbPath);
            
            // Compress the data
            const compressedData = await this.compressData(originalData);
            backupInfo.compressedSize = compressedData.length;
            
            let finalData = compressedData;
            let backupExtension = '.db.gz';
            
            // Encrypt if enabled
            if (this.encryptBackups && this.encryptionKey) {
                finalData = await this.encryptData(compressedData);
                backupExtension = '.db.gz.enc';
                backupInfo.encryptedSize = finalData.length;
            }
            
            // Write backup file
            const backupFileName = `${backupName}${backupExtension}`;
            const backupFilePath = path.join(this.backupDir, backupFileName);
            fs.writeFileSync(backupFilePath, finalData);
            
            // Write backup info file
            const infoFileName = `${backupName}.info.json`;
            const infoFilePath = path.join(this.backupDir, infoFileName);
            fs.writeFileSync(infoFilePath, JSON.stringify(backupInfo, null, 2));
            
            // Verify backup integrity
            await this.verifyBackup(backupFilePath, originalData.length);
            
            const duration = Date.now() - startTime;
            const compressionRatio = ((originalData.length - compressedData.length) / originalData.length * 100).toFixed(2);
            
            logger.info('Database backup completed successfully', {
                backupName,
                backupFile: backupFilePath,
                originalSize: originalData.length,
                compressedSize: compressedData.length,
                finalSize: finalData.length,
                compressionRatio: `${compressionRatio}%`,
                encrypted: this.encryptBackups,
                duration: `${duration}ms`
            });
            
            SecurityLogger.logBackup('success', {
                backupName,
                backupFile: backupFileName,
                size: finalData.length,
                duration
            });
            
            return {
                success: true,
                backupName,
                backupFile: backupFilePath,
                info: backupInfo,
                duration
            };
            
        } catch (error) {
            logger.error('Database backup failed', {
                error: error.message,
                backupName,
                duration: Date.now() - startTime
            });
            
            SecurityLogger.logBackup('failed', {
                backupName,
                error: error.message,
                duration: Date.now() - startTime
            });
            
            throw error;
        }
    }

    async restoreBackup(backupName, options = {}) {
        const startTime = Date.now();
        
        try {
            logger.info('Starting database restore', { backupName });
            
            // Find backup files
            const backupFiles = this.findBackupFiles(backupName);
            if (!backupFiles.dataFile) {
                throw new Error(`Backup not found: ${backupName}`);
            }
            
            // Load backup info
            let backupInfo = null;
            if (backupFiles.infoFile) {
                backupInfo = JSON.parse(fs.readFileSync(backupFiles.infoFile, 'utf8'));
            }
            
            // Create backup of current database
            if (!options.skipCurrentBackup && fs.existsSync(this.dbPath)) {
                await this.createBackup({ name: `pre-restore-${Date.now()}`, type: 'pre-restore' });
            }
            
            // Read backup data
            let backupData = fs.readFileSync(backupFiles.dataFile);
            
            // Decrypt if necessary
            if (backupInfo && backupInfo.encrypted) {
                if (!this.encryptionKey) {
                    throw new Error('Encryption key required for encrypted backup');
                }
                backupData = await this.decryptData(backupData);
            }
            
            // Decompress
            const originalData = await this.decompressData(backupData);
            
            // Write restored database
            fs.writeFileSync(this.dbPath, originalData);
            
            // Verify restored database
            const restoredSize = fs.statSync(this.dbPath).size;
            if (backupInfo && backupInfo.originalSize !== restoredSize) {
                logger.warn('Restored database size differs from original', {
                    original: backupInfo.originalSize,
                    restored: restoredSize
                });
            }
            
            const duration = Date.now() - startTime;
            
            logger.info('Database restore completed successfully', {
                backupName,
                restoredSize,
                duration: `${duration}ms`
            });
            
            SecurityLogger.logBackup('restore_success', {
                backupName,
                restoredSize,
                duration
            });
            
            return {
                success: true,
                backupName,
                restoredSize,
                duration
            };
            
        } catch (error) {
            logger.error('Database restore failed', {
                error: error.message,
                backupName,
                duration: Date.now() - startTime
            });
            
            SecurityLogger.logBackup('restore_failed', {
                backupName,
                error: error.message,
                duration: Date.now() - startTime
            });
            
            throw error;
        }
    }

    async cleanupOldBackups() {
        try {
            logger.info('Starting backup cleanup', { retentionDays: this.retentionDays });
            
            const cutoffDate = new Date(Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000));
            const files = fs.readdirSync(this.backupDir);
            
            let deletedCount = 0;
            let totalSize = 0;
            
            for (const file of files) {
                const filePath = path.join(this.backupDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime < cutoffDate) {
                    totalSize += stats.size;
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    logger.debug('Deleted old backup file', { file, size: stats.size });
                }
            }
            
            logger.info('Backup cleanup completed', {
                deletedFiles: deletedCount,
                freedSpace: totalSize,
                retentionDays: this.retentionDays
            });
            
            return { deletedFiles: deletedCount, freedSpace: totalSize };
            
        } catch (error) {
            logger.error('Backup cleanup failed', { error: error.message });
            throw error;
        }
    }

    async listBackups() {
        try {
            const files = fs.readdirSync(this.backupDir);
            const backups = [];
            
            for (const file of files) {
                if (file.endsWith('.info.json')) {
                    const infoPath = path.join(this.backupDir, file);
                    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                    
                    const dataFileName = file.replace('.info.json', info.encrypted ? '.db.gz.enc' : '.db.gz');
                    const dataFilePath = path.join(this.backupDir, dataFileName);
                    
                    if (fs.existsSync(dataFilePath)) {
                        const stats = fs.statSync(dataFilePath);
                        backups.push({
                            ...info,
                            dataFile: dataFileName,
                            fileSize: stats.size,
                            age: Date.now() - new Date(info.timestamp).getTime()
                        });
                    }
                }
            }
            
            return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
        } catch (error) {
            logger.error('Error listing backups', { error: error.message });
            throw error;
        }
    }

    async verifyBackup(backupFilePath, expectedOriginalSize) {
        try {
            // Basic file existence and size check
            if (!fs.existsSync(backupFilePath)) {
                throw new Error('Backup file does not exist');
            }
            
            const stats = fs.statSync(backupFilePath);
            if (stats.size === 0) {
                throw new Error('Backup file is empty');
            }
            
            // Could add more sophisticated verification here
            // like attempting to decompress/decrypt and validate
            
            return true;
        } catch (error) {
            logger.error('Backup verification failed', { 
                backupFile: backupFilePath,
                error: error.message 
            });
            throw error;
        }
    }

    findBackupFiles(backupName) {
        const infoFile = path.join(this.backupDir, `${backupName}.info.json`);
        let dataFile = null;
        
        // Try encrypted compressed format first
        let candidate = path.join(this.backupDir, `${backupName}.db.gz.enc`);
        if (fs.existsSync(candidate)) {
            dataFile = candidate;
        } else {
            // Try regular compressed format
            candidate = path.join(this.backupDir, `${backupName}.db.gz`);
            if (fs.existsSync(candidate)) {
                dataFile = candidate;
            }
        }
        
        return {
            infoFile: fs.existsSync(infoFile) ? infoFile : null,
            dataFile
        };
    }

    async compressData(data) {
        return new Promise((resolve, reject) => {
            zlib.gzip(data, { level: 6 }, (error, compressed) => {
                if (error) reject(error);
                else resolve(compressed);
            });
        });
    }

    async decompressData(data) {
        return new Promise((resolve, reject) => {
            zlib.gunzip(data, (error, decompressed) => {
                if (error) reject(error);
                else resolve(decompressed);
            });
        });
    }

    async encryptData(data) {
        const algorithm = 'aes-256-gcm';
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(algorithm, this.encryptionKey);
        
        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        const authTag = cipher.getAuthTag();
        
        // Prepend IV and auth tag to encrypted data
        return Buffer.concat([iv, authTag, encrypted]);
    }

    async decryptData(data) {
        const algorithm = 'aes-256-gcm';
        const iv = data.slice(0, 16);
        const authTag = data.slice(16, 32);
        const encrypted = data.slice(32);
        
        const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted;
    }

    getBackupStats() {
        try {
            const files = fs.readdirSync(this.backupDir);
            let totalSize = 0;
            let backupCount = 0;
            
            for (const file of files) {
                if (file.includes('.db.gz')) {
                    const stats = fs.statSync(path.join(this.backupDir, file));
                    totalSize += stats.size;
                    backupCount++;
                }
            }
            
            return {
                backupCount,
                totalSize,
                backupDir: this.backupDir,
                retentionDays: this.retentionDays,
                encryptionEnabled: this.encryptBackups
            };
        } catch (error) {
            logger.error('Error getting backup stats', { error: error.message });
            return null;
        }
    }
}

// CLI interface
if (require.main === module) {
    const backupService = new BackupService();
    const command = process.argv[2];
    const arg = process.argv[3];
    
    async function runCommand() {
        try {
            switch (command) {
                case 'create':
                    const backupResult = await backupService.createBackup({
                        name: arg,
                        type: 'manual'
                    });
                    console.log('Backup created successfully:', backupResult.backupName);
                    break;
                    
                case 'restore':
                    if (!arg) {
                        console.error('Backup name required for restore');
                        process.exit(1);
                    }
                    await backupService.restoreBackup(arg);
                    console.log('Database restored successfully from:', arg);
                    break;
                    
                case 'list':
                    const backups = await backupService.listBackups();
                    console.log('Available backups:');
                    backups.forEach(backup => {
                        console.log(`  ${backup.name} (${new Date(backup.timestamp).toLocaleString()}) - ${(backup.fileSize / 1024 / 1024).toFixed(2)}MB`);
                    });
                    break;
                    
                case 'cleanup':
                    const cleanupResult = await backupService.cleanupOldBackups();
                    console.log(`Cleaned up ${cleanupResult.deletedFiles} old backups, freed ${(cleanupResult.freedSpace / 1024 / 1024).toFixed(2)}MB`);
                    break;
                    
                case 'stats':
                    const stats = backupService.getBackupStats();
                    console.log('Backup statistics:', stats);
                    break;
                    
                default:
                    console.log('Usage: node backup.js <command> [args]');
                    console.log('Commands:');
                    console.log('  create [name]     - Create a new backup');
                    console.log('  restore <name>    - Restore from backup');
                    console.log('  list              - List all backups');
                    console.log('  cleanup           - Clean up old backups');
                    console.log('  stats             - Show backup statistics');
                    break;
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }
    
    runCommand();
}

module.exports = BackupService;