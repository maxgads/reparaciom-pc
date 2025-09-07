#!/usr/bin/env node
/**
 * Monitor Keep-Alive Script
 * Mantiene la aplicación activa con health checks automáticos
 * Compatible con n8n, Make, Zapier y otros servicios de automatización
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class KeepAliveMonitor {
    constructor(options = {}) {
        this.config = {
            // URL base de tu aplicación
            baseUrl: process.env.BASE_URL || 'http://localhost:3000',
            
            // Intervalos de ping (en minutos)
            pingInterval: process.env.KEEPALIVE_INTERVAL || 5,
            healthCheckInterval: process.env.HEALTH_CHECK_INTERVAL || 10,
            
            // Configuración de reintentos
            maxRetries: 3,
            retryDelay: 30000, // 30 segundos
            
            // Archivos de log
            logFile: './logs/keepalive.log',
            statusFile: './logs/keepalive-status.json',
            
            // Webhooks para notificaciones externas
            webhookUrls: {
                n8n: process.env.N8N_WEBHOOK_URL,
                make: process.env.MAKE_WEBHOOK_URL,
                slack: process.env.SLACK_WEBHOOK_URL,
                discord: process.env.DISCORD_WEBHOOK_URL
            },
            
            // Configuración de alertas
            alertOnFailure: process.env.ALERT_ON_FAILURE !== 'false',
            alertOnRecovery: process.env.ALERT_ON_RECOVERY !== 'false',
            
            ...options
        };
        
        this.isRunning = false;
        this.failureCount = 0;
        this.lastSuccessTime = null;
        this.lastFailureTime = null;
        this.status = 'unknown';
    }

    async start() {
        if (this.isRunning) {
            console.log('⚠️  Monitor ya está ejecutándose');
            return;
        }

        this.isRunning = true;
        console.log(`🚀 Iniciando Keep-Alive Monitor para ${this.config.baseUrl}`);
        console.log(`📊 Ping cada ${this.config.pingInterval} minutos`);
        console.log(`🔍 Health check cada ${this.config.healthCheckInterval} minutos`);
        
        // Crear directorio de logs si no existe
        await this.ensureLogDirectory();
        
        // Ping inicial
        await this.performPing();
        
        // Configurar intervalos
        this.pingTimer = setInterval(() => {
            this.performPing();
        }, this.config.pingInterval * 60 * 1000);
        
        this.healthTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval * 60 * 1000);
        
        // Manejar cierre graceful
        process.on('SIGINT', () => this.stop());
        process.on('SIGTERM', () => this.stop());
        
        console.log('✅ Monitor iniciado correctamente');
    }

    async stop() {
        if (!this.isRunning) return;
        
        console.log('🛑 Deteniendo Keep-Alive Monitor...');
        this.isRunning = false;
        
        if (this.pingTimer) clearInterval(this.pingTimer);
        if (this.healthTimer) clearInterval(this.healthTimer);
        
        await this.saveStatus();
        console.log('✅ Monitor detenido');
        process.exit(0);
    }

    async performPing() {
        const timestamp = new Date().toISOString();
        
        try {
            const startTime = Date.now();
            const response = await axios.get(`${this.config.baseUrl}/api/webhook/keepalive`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'KeepAlive-Monitor/1.0'
                }
            });
            
            const responseTime = Date.now() - startTime;
            
            if (response.status === 200 && response.data.status === 'alive') {
                await this.handleSuccess(responseTime, timestamp);
            } else {
                await this.handleFailure(`Estado inesperado: ${response.data.status}`, timestamp);
            }
        } catch (error) {
            await this.handleFailure(error.message, timestamp);
        }
    }

    async performHealthCheck() {
        const timestamp = new Date().toISOString();
        
        try {
            const response = await axios.get(`${this.config.baseUrl}/api/health`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'KeepAlive-Monitor/1.0'
                }
            });
            
            if (response.status === 200 && response.data.status === 'healthy') {
                await this.logEvent('info', 'Health check passed', {
                    uptime: response.data.uptime,
                    memory: response.data.memory,
                    services: response.data.services
                });
            } else {
                await this.logEvent('warning', 'Health check degraded', {
                    status: response.data.status,
                    issues: response.data.issues
                });
            }
        } catch (error) {
            await this.logEvent('error', 'Health check failed', { error: error.message });
        }
    }

    async handleSuccess(responseTime, timestamp) {
        const wasDown = this.status === 'down';
        
        this.status = 'up';
        this.lastSuccessTime = timestamp;
        this.failureCount = 0;
        
        await this.logEvent('info', `✅ Ping exitoso (${responseTime}ms)`, {
            responseTime,
            timestamp,
            consecutiveFailures: 0
        });
        
        // Alertar si se recuperó de una falla
        if (wasDown && this.config.alertOnRecovery) {
            await this.sendAlert('recovery', {
                message: '🎉 Servicio recuperado',
                responseTime,
                timestamp,
                downtime: this.calculateDowntime()
            });
        }
        
        await this.saveStatus();
    }

    async handleFailure(error, timestamp) {
        this.failureCount++;
        this.status = 'down';
        this.lastFailureTime = timestamp;
        
        await this.logEvent('error', `❌ Ping falló (intento ${this.failureCount}/${this.config.maxRetries})`, {
            error,
            timestamp,
            consecutiveFailures: this.failureCount
        });
        
        // Enviar alerta después de varios fallos
        if (this.failureCount >= this.config.maxRetries && this.config.alertOnFailure) {
            await this.sendAlert('failure', {
                message: '🚨 Servicio no responde',
                error,
                consecutiveFailures: this.failureCount,
                lastSuccess: this.lastSuccessTime,
                timestamp
            });
        }
        
        await this.saveStatus();
        
        // Intentar reinicio automático si hay muchos fallos
        if (this.failureCount >= this.config.maxRetries * 2) {
            await this.attemptRestart();
        }
    }

    async attemptRestart() {
        try {
            await this.logEvent('warning', '🔄 Intentando reinicio automático...');
            
            // Intentar reiniciar con PM2
            const { exec } = require('child_process');
            exec('pm2 restart reparaciones-pc', (error, stdout, stderr) => {
                if (error) {
                    this.logEvent('error', 'Error al reiniciar con PM2', { error: error.message });
                } else {
                    this.logEvent('info', 'Reinicio PM2 exitoso', { stdout });
                }
            });
        } catch (error) {
            await this.logEvent('error', 'Error durante reinicio automático', { error: error.message });
        }
    }

    async sendAlert(type, data) {
        const alert = {
            service: 'Reparaciones PC',
            type,
            timestamp: new Date().toISOString(),
            url: this.config.baseUrl,
            ...data
        };
        
        // Enviar a todos los webhooks configurados
        for (const [service, url] of Object.entries(this.config.webhookUrls)) {
            if (url) {
                try {
                    await axios.post(url, alert, {
                        timeout: 5000,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    await this.logEvent('info', `Alerta enviada a ${service}`);
                } catch (error) {
                    await this.logEvent('error', `Error enviando alerta a ${service}`, { error: error.message });
                }
            }
        }
    }

    calculateDowntime() {
        if (!this.lastFailureTime || !this.lastSuccessTime) return null;
        
        const downStart = new Date(this.lastFailureTime);
        const downEnd = new Date();
        return Math.round((downEnd - downStart) / 1000); // segundos
    }

    async ensureLogDirectory() {
        const logDir = path.dirname(this.config.logFile);
        try {
            await fs.access(logDir);
        } catch {
            await fs.mkdir(logDir, { recursive: true });
        }
    }

    async logEvent(level, message, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            service: 'keepalive-monitor',
            ...data
        };
        
        // Log a consola
        const emoji = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : '✅';
        console.log(`${emoji} [${logEntry.timestamp}] ${message}`);
        
        // Log a archivo
        try {
            const logLine = JSON.stringify(logEntry) + '\n';
            await fs.appendFile(this.config.logFile, logLine);
        } catch (error) {
            console.error('Error escribiendo log:', error.message);
        }
    }

    async saveStatus() {
        const status = {
            isRunning: this.isRunning,
            status: this.status,
            failureCount: this.failureCount,
            lastSuccessTime: this.lastSuccessTime,
            lastFailureTime: this.lastFailureTime,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
        
        try {
            await fs.writeFile(this.config.statusFile, JSON.stringify(status, null, 2));
        } catch (error) {
            console.error('Error guardando estado:', error.message);
        }
    }

    async getStatus() {
        try {
            const data = await fs.readFile(this.config.statusFile, 'utf8');
            return JSON.parse(data);
        } catch {
            return null;
        }
    }
}

// Si se ejecuta directamente
if (require.main === module) {
    const monitor = new KeepAliveMonitor();
    
    // Procesar argumentos de línea de comandos
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
🔍 Keep-Alive Monitor para Reparaciones PC

Uso:
  node monitor-keepalive.js [opciones]

Opciones:
  --help, -h          Mostrar esta ayuda
  --status, -s        Mostrar estado actual
  --test, -t          Realizar test de conexión único
  --stop              Detener monitor en ejecución

Variables de entorno:
  BASE_URL                    URL de la aplicación (default: http://localhost:3000)
  KEEPALIVE_INTERVAL          Intervalo de ping en minutos (default: 5)
  HEALTH_CHECK_INTERVAL       Intervalo de health check en minutos (default: 10)
  N8N_WEBHOOK_URL            URL webhook para n8n
  MAKE_WEBHOOK_URL           URL webhook para Make.com
  SLACK_WEBHOOK_URL          URL webhook para Slack
  DISCORD_WEBHOOK_URL        URL webhook para Discord

Ejemplos:
  # Iniciar monitor
  node monitor-keepalive.js

  # Ver estado
  node monitor-keepalive.js --status

  # Test de conexión
  node monitor-keepalive.js --test
        `);
        process.exit(0);
    }
    
    if (args.includes('--status') || args.includes('-s')) {
        monitor.getStatus().then(status => {
            if (status) {
                console.log('📊 Estado del Monitor:');
                console.log(JSON.stringify(status, null, 2));
            } else {
                console.log('❌ No hay estado guardado');
            }
            process.exit(0);
        });
        return;
    }
    
    if (args.includes('--test') || args.includes('-t')) {
        console.log('🧪 Realizando test de conexión...');
        monitor.performPing().then(() => {
            console.log('✅ Test completado');
            process.exit(0);
        });
        return;
    }
    
    // Iniciar monitor
    monitor.start().catch(console.error);
}

module.exports = KeepAliveMonitor;