# 🛡️ Guía Completa de Seguridad

## 📋 Índice
1. [Configuración de Firewall](#configuración-de-firewall)
2. [Configuración SSL/TLS](#configuración-ssltls)
3. [Protección contra Ataques](#protección-contra-ataques)
4. [Monitoreo y Alertas](#monitoreo-y-alertas)
5. [Hardening del Sistema](#hardening-del-sistema)
6. [Respuesta a Incidentes](#respuesta-a-incidentes)
7. [Auditoría de Seguridad](#auditoría-de-seguridad)

---

## 🔥 Configuración de Firewall

### 🐧 Linux (UFW)

#### Configuración Inicial
```bash
# Resetear reglas existentes
sudo ufw --force reset

# Política por defecto: denegar entrante, permitir saliente
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir SSH (CRÍTICO - no te bloquees)
sudo ufw allow ssh
sudo ufw allow 22/tcp

# Permitir HTTP y HTTPS
sudo ufw allow 80/tcp comment "HTTP"
sudo ufw allow 443/tcp comment "HTTPS"

# Habilitar firewall
sudo ufw --force enable

# Verificar estado
sudo ufw status verbose
```

#### Configuración Avanzada
```bash
# Script: scripts/firewall-setup.sh
#!/bin/bash

echo "=== CONFIGURACIÓN AVANZADA DE FIREWALL ==="

# Permitir loopback
sudo ufw allow in on lo
sudo ufw allow out on lo

# Permitir ping (opcional)
sudo ufw allow out 53
sudo ufw allow in 53

# Rate limiting para SSH (prevenir fuerza bruta)
sudo ufw limit ssh/tcp

# Permitir solo rangos específicos para SSH (opcional)
# sudo ufw allow from 192.168.1.0/24 to any port 22

# Bloquear rangos maliciosos conocidos
# sudo ufw deny from 192.168.1.100  # Ejemplo de IP específica

# Logging
sudo ufw logging on

echo "✅ Firewall configurado correctamente"
sudo ufw status numbered
```

### 🪟 Windows Firewall

```cmd
REM Script: scripts/firewall-setup.bat
@echo off

echo === CONFIGURACION DE FIREWALL WINDOWS ===

REM Habilitar Windows Firewall
netsh advfirewall set allprofiles state on

REM Permitir HTTP
netsh advfirewall firewall add rule name="HTTP Inbound" dir=in action=allow protocol=TCP localport=80

REM Permitir HTTPS  
netsh advfirewall firewall add rule name="HTTPS Inbound" dir=in action=allow protocol=TCP localport=443

REM Permitir Node.js (puerto 3000)
netsh advfirewall firewall add rule name="Node.js App" dir=in action=allow protocol=TCP localport=3000 program="C:\Program Files\nodejs\node.exe"

REM Mostrar reglas
netsh advfirewall firewall show rule name=all | findstr "HTTP\|Node"

echo Firewall configurado correctamente
```

---

## 🔐 Configuración SSL/TLS

### 🔧 Configuración nginx SSL Hardening

```nginx
# Configuración SSL ultra-segura
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

# Perfect Forward Secrecy
ssl_dhparam /etc/nginx/dhparam.pem;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/DOMAIN/chain.pem;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# Headers de seguridad
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### 🔑 Generar Parámetros DH Seguros

```bash
# Generar dhparam (puede tomar varios minutos)
sudo openssl dhparam -out /etc/nginx/dhparam.pem 2048

# Para máxima seguridad (más lento)
# sudo openssl dhparam -out /etc/nginx/dhparam.pem 4096
```

### 🧪 Test de SSL

```bash
#!/bin/bash
# Script: scripts/ssl-security-test.sh

DOMAIN=$(grep "^DOMAIN=" .env | cut -d'=' -f2)

echo "=== TEST DE SEGURIDAD SSL ==="
echo "Dominio: $DOMAIN"
echo

# Test de certificado
echo "1. Verificando certificado..."
openssl s_client -connect $DOMAIN:443 -servername $DOMAIN </dev/null 2>/dev/null | openssl x509 -noout -dates

# Test de protocolos
echo
echo "2. Verificando protocolos soportados..."
for protocol in ssl3 tls1 tls1_1 tls1_2 tls1_3; do
    result=$(echo | timeout 5 openssl s_client -connect $DOMAIN:443 -$protocol 2>/dev/null | grep "Protocol")
    if [ -n "$result" ]; then
        echo "   $protocol: SOPORTADO"
    else
        echo "   $protocol: NO SOPORTADO (correcto)"
    fi
done

# Test online (SSL Labs)
echo
echo "3. Para análisis completo, visita:"
echo "   https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"

echo
echo "4. Verificar headers de seguridad:"
curl -I https://$DOMAIN | grep -E "(Strict-Transport|X-Frame|X-Content|X-XSS)"
```

---

## 🛡️ Protección contra Ataques

### 🚫 Rate Limiting Avanzado

```javascript
// backend/middleware/rateLimiter.js - Ejemplo de implementación
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Rate limiter estricto para formulario de contacto
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // máximo 3 requests por hora
    message: {
        error: 'Demasiadas consultas. Intenta nuevamente en 1 hora.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Whitelist para IPs específicas
    skip: (req) => {
        const whitelist = ['127.0.0.1', '::1'];
        return whitelist.includes(req.ip);
    }
});

// Slowdown progresivo
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutos
    delayAfter: 10, // permitir 10 requests a velocidad completa
    delayMs: 500 // agregar 500ms de delay por cada request adicional
});

module.exports = { contactLimiter, speedLimiter };
```

### 🔍 Detección de Comportamiento Sospechoso

```bash
#!/bin/bash
# Script: scripts/security-monitor.sh

LOG_FILE="logs/security.log"
NGINX_LOG="/var/log/nginx/access.log"
ALERT_THRESHOLD=50

# Función de logging
security_log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - SECURITY - $1" | tee -a "$LOG_FILE"
}

# Detectar múltiples requests desde una IP
detect_flooding() {
    local suspicious_ips=$(tail -1000 "$NGINX_LOG" | awk '{print $1}' | sort | uniq -c | sort -nr | head -10)
    
    while read count ip; do
        if [ "$count" -gt "$ALERT_THRESHOLD" ]; then
            security_log "ALERT: IP $ip realizó $count requests (threshold: $ALERT_THRESHOLD)"
            
            # Auto-bloquear IP sospechosa
            sudo ufw deny from "$ip"
            security_log "ACTION: IP $ip bloqueada automáticamente"
            
            # Opcional: Enviar notificación
            if [ ! -z "$WEBHOOK_URL" ]; then
                curl -X POST "$WEBHOOK_URL" \
                    -H "Content-Type: application/json" \
                    -d "{\"text\":\"🚨 IP bloqueada: $ip ($count requests)\"}"
            fi
        fi
    done <<< "$suspicious_ips"
}

# Detectar patrones de ataque comunes
detect_attack_patterns() {
    local attacks=$(tail -1000 "$NGINX_LOG" | grep -E "(sql|script|union|select|drop|insert|update|delete|exec|eval)" -i)
    
    if [ ! -z "$attacks" ]; then
        security_log "ALERT: Patrones de ataque detectados:"
        echo "$attacks" | while read line; do
            security_log "   $line"
        done
    fi
}

# Verificar intentos de acceso a archivos sensibles
detect_file_access() {
    local sensitive_access=$(tail -1000 "$NGINX_LOG" | grep -E "(\.env|\.sql|\.bak|\.log|config|admin|wp-admin)" -i)
    
    if [ ! -z "$sensitive_access" ]; then
        security_log "ALERT: Intentos de acceso a archivos sensibles:"
        echo "$sensitive_access" | while read line; do
            security_log "   $line"
        done
    fi
}

# Ejecutar detecciones
detect_flooding
detect_attack_patterns  
detect_file_access

# Limpiar logs antiguos (mantener últimos 30 días)
find logs/ -name "*.log" -mtime +30 -delete
```

### 🔒 Fail2Ban Configuración

```bash
# Instalar fail2ban
sudo apt install fail2ban -y

# Configuración personalizada
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
ignoreip = 127.0.0.1/8 ::1

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 6

[nginx-badbots]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2

[nginx-noproxy]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2
EOF

# Reiniciar fail2ban
sudo systemctl restart fail2ban

# Verificar estado
sudo fail2ban-client status
```

---

## 📊 Monitoreo y Alertas

### 🔔 Sistema de Alertas

```bash
#!/bin/bash
# Script: scripts/alert-system.sh

ALERT_EMAIL="admin@tu-dominio.com"
WEBHOOK_URL="$WEBHOOK_URL" # Slack/Discord webhook

send_email_alert() {
    local subject="$1"
    local message="$2"
    
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "$subject" "$ALERT_EMAIL"
    fi
}

send_webhook_alert() {
    local message="$1"
    
    if [ ! -z "$WEBHOOK_URL" ]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🚨 ALERT: $message\"}" \
            >/dev/null 2>&1
    fi
}

# Verificar servicios críticos
check_services() {
    if ! systemctl is-active --quiet reparacion-pc; then
        local alert="Servicio reparacion-pc caído en $(hostname)"
        send_email_alert "Servicio Caído" "$alert"
        send_webhook_alert "$alert"
    fi
    
    if ! systemctl is-active --quiet nginx; then
        local alert="Nginx caído en $(hostname)"
        send_email_alert "Nginx Caído" "$alert" 
        send_webhook_alert "$alert"
    fi
}

# Verificar espacio en disco
check_disk_space() {
    local usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$usage" -gt 90 ]; then
        local alert="Espacio en disco crítico: ${usage}% en $(hostname)"
        send_email_alert "Espacio en Disco Crítico" "$alert"
        send_webhook_alert "$alert"
    fi
}

# Verificar SSL próximo a vencer
check_ssl_expiry() {
    source .env
    if [ ! -z "$DOMAIN" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/cert.pem" ]; then
        if ! openssl x509 -checkend 2592000 -noout -in "/etc/letsencrypt/live/$DOMAIN/cert.pem"; then
            local alert="Certificado SSL expira pronto para $DOMAIN"
            send_email_alert "SSL Próximo a Expirar" "$alert"
            send_webhook_alert "$alert"
        fi
    fi
}

# Ejecutar verificaciones
check_services
check_disk_space  
check_ssl_expiry
```

### 📈 Dashboard de Seguridad

```bash
#!/bin/bash
# Script: scripts/security-dashboard.sh

clear
echo "════════════════════════════════════════════════"
echo "    🛡️  DASHBOARD DE SEGURIDAD"
echo "════════════════════════════════════════════════"
echo

# Estado del firewall
echo "🔥 FIREWALL:"
if command -v ufw >/dev/null 2>&1; then
    ufw_status=$(sudo ufw status | head -1)
    echo "   $ufw_status"
    blocked_count=$(sudo ufw status numbered | grep -c "DENY")
    echo "   IPs bloqueadas: $blocked_count"
else
    echo "   UFW no instalado"
fi
echo

# Estado SSL
echo "🔐 SSL/TLS:"
source .env 2>/dev/null
if [ ! -z "$DOMAIN" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/cert.pem" ]; then
    expiry=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/cert.pem" | cut -d= -f2)
    echo "   Certificado válido hasta: $expiry"
    
    if openssl x509 -checkend 2592000 -noout -in "/etc/letsencrypt/live/$DOMAIN/cert.pem"; then
        echo "   ✅ Certificado OK (>30 días)"
    else
        echo "   ⚠️  Certificado expira pronto"
    fi
else
    echo "   ❌ SSL no configurado"
fi
echo

# Fail2ban status
echo "🚫 FAIL2BAN:"
if command -v fail2ban-client >/dev/null 2>&1; then
    banned_ips=$(sudo fail2ban-client status | grep -o "Jail list:.*" | wc -w)
    echo "   Jails activos: $((banned_ips - 2))"
    
    # IPs baneadas
    total_banned=0
    for jail in nginx-http-auth nginx-noscript nginx-badbots; do
        if sudo fail2ban-client status "$jail" >/dev/null 2>&1; then
            banned=$(sudo fail2ban-client status "$jail" | grep "Currently banned" | grep -o "[0-9]*")
            total_banned=$((total_banned + banned))
        fi
    done
    echo "   IPs baneadas total: $total_banned"
else
    echo "   Fail2ban no instalado"
fi
echo

# Últimas alertas de seguridad  
echo "🚨 ÚLTIMAS ALERTAS:"
if [ -f "logs/security.log" ]; then
    tail -5 logs/security.log | while read line; do
        echo "   $line"
    done
else
    echo "   No hay alertas recientes"
fi
echo

# Estadísticas de acceso sospechoso
echo "📊 ACCESOS SOSPECHOSOS (últimas 24h):"
if [ -f "/var/log/nginx/access.log" ]; then
    # Top IPs con más requests
    echo "   Top IPs por requests:"
    yesterday=$(date -d "yesterday" +%d/%b/%Y)
    today=$(date +%d/%b/%Y)
    
    grep -E "($yesterday|$today)" /var/log/nginx/access.log | \
    awk '{print $1}' | sort | uniq -c | sort -nr | head -3 | \
    while read count ip; do
        echo "     $ip: $count requests"
    done
    
    # Errores 4xx y 5xx
    error_count=$(grep -E "($yesterday|$today)" /var/log/nginx/access.log | grep -E " (4[0-9][0-9]|5[0-9][0-9]) " | wc -l)
    echo "   Errores 4xx/5xx: $error_count"
else
    echo "   Log de nginx no accesible"
fi

echo
echo "════════════════════════════════════════════════"
```

---

## 🔧 Hardening del Sistema

### 🔐 SSH Hardening

```bash
#!/bin/bash
# Script: scripts/ssh-hardening.sh

echo "=== SSH HARDENING ==="

# Backup de configuración original
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Configuración segura SSH
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf << 'EOF'
# Deshabilitar root login
PermitRootLogin no

# Solo autenticación por clave pública
PasswordAuthentication no
PubkeyAuthentication yes

# Deshabilitar métodos inseguros
ChallengeResponseAuthentication no
UsePAM yes
PermitEmptyPasswords no

# Timeout y reintentos
LoginGraceTime 30
MaxAuthTries 3
MaxStartups 3

# Protocolo y cifrado
Protocol 2
Ciphers aes256-gcm@openssh.com,chacha20-poly1305@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,hmac-sha2-256,hmac-sha2-512

# Banner de advertencia
Banner /etc/ssh/banner
EOF

# Crear banner de advertencia
sudo tee /etc/ssh/banner << 'EOF'
***************************************************************************
                    SISTEMA PRIVADO - ACCESO AUTORIZADO ÚNICAMENTE
                          
El acceso no autorizado está prohibido y será procesado según la ley.
Todas las actividades están monitoreadas y registradas.
***************************************************************************
EOF

# Reiniciar SSH
sudo systemctl restart ssh

echo "✅ SSH hardening completado"
```

### 🛡️ Sistema Hardening

```bash
#!/bin/bash  
# Script: scripts/system-hardening.sh

echo "=== SYSTEM HARDENING ==="

# 1. Actualizar sistema
echo "1. Actualizando sistema..."
sudo apt update && sudo apt upgrade -y

# 2. Instalar herramientas de seguridad
echo "2. Instalando herramientas de seguridad..."
sudo apt install -y ufw fail2ban rkhunter chkrootkit lynis

# 3. Configurar límites de usuario
echo "3. Configurando límites de usuario..."
sudo tee -a /etc/security/limits.conf << 'EOF'
# Límites de procesos y archivos abiertos
* soft nproc 1000
* hard nproc 1000
* soft nofile 1024  
* hard nofile 2048
EOF

# 4. Deshabilitar servicios innecesarios
echo "4. Deshabilitando servicios innecesarios..."
services_to_disable=(
    bluetooth
    cups
    avahi-daemon
)

for service in "${services_to_disable[@]}"; do
    if systemctl is-enabled "$service" >/dev/null 2>&1; then
        sudo systemctl disable "$service"
        echo "   ✅ $service deshabilitado"
    fi
done

# 5. Configurar kernel parameters de seguridad
echo "5. Configurando parámetros de kernel..."
sudo tee /etc/sysctl.d/99-security.conf << 'EOF'
# Protección contra IP spoofing
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.default.rp_filter=1

# Deshabilitar redirects ICMP
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.default.accept_redirects=0
net.ipv6.conf.all.accept_redirects=0  
net.ipv6.conf.default.accept_redirects=0

# Deshabilitar source routing
net.ipv4.conf.all.accept_source_route=0
net.ipv4.conf.default.accept_source_route=0
net.ipv6.conf.all.accept_source_route=0
net.ipv6.conf.default.accept_source_route=0

# Log de paquetes sospechosos
net.ipv4.conf.all.log_martians=1
net.ipv4.conf.default.log_martians=1

# Protección SYN flood
net.ipv4.tcp_syncookies=1
net.ipv4.tcp_max_syn_backlog=2048
net.ipv4.tcp_synack_retries=2
net.ipv4.tcp_syn_retries=5

# Ignorar ping broadcasts
net.ipv4.icmp_echo_ignore_broadcasts=1
EOF

sudo sysctl -p /etc/sysctl.d/99-security.conf

# 6. Configurar permisos de archivos críticos
echo "6. Configurando permisos de archivos..."
sudo chmod 600 /etc/shadow
sudo chmod 600 /etc/gshadow  
sudo chmod 644 /etc/passwd
sudo chmod 644 /etc/group

# 7. Instalar y configurar auditd
echo "7. Configurando auditd..."
sudo apt install -y auditd audispd-plugins

sudo tee /etc/audit/rules.d/99-security.rules << 'EOF'
# Monitorear cambios en archivos críticos
-w /etc/passwd -p wa -k identity
-w /etc/group -p wa -k identity  
-w /etc/shadow -p wa -k identity
-w /etc/gshadow -p wa -k identity

# Monitorear comandos de administración
-w /usr/bin/sudo -p x -k admin_commands
-w /usr/sbin/useradd -p x -k user_management
-w /usr/sbin/userdel -p x -k user_management

# Monitorear cambios en configuración de red
-w /etc/network/interfaces -p wa -k network_config
-w /etc/hosts -p wa -k network_config
EOF

sudo systemctl restart auditd

echo "✅ System hardening completado"
```

---

## 🚨 Respuesta a Incidentes

### 📋 Plan de Respuesta a Incidentes

```bash
#!/bin/bash
# Script: scripts/incident-response.sh

INCIDENT_LOG="logs/incidents.log"
BACKUP_DIR="backups/incident-$(date +%Y%m%d_%H%M%S)"

incident_log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - INCIDENT - $1" | tee -a "$INCIDENT_LOG"
}

echo "=== RESPUESTA A INCIDENTE DE SEGURIDAD ==="
echo

# 1. Crear backup de emergencia
echo "1. Creando backup de emergencia..."
mkdir -p "$BACKUP_DIR"
cp -r database logs config .env "$BACKUP_DIR/"
incident_log "Backup de emergencia creado en $BACKUP_DIR"

# 2. Análisis inicial
echo "2. Análisis inicial del sistema..."

# Verificar procesos sospechosos
echo "   Procesos con alta CPU:"
ps aux --sort=-%cpu | head -10

# Verificar conexiones de red
echo "   Conexiones de red activas:"
netstat -tuln | grep LISTEN

# Verificar últimos logins
echo "   Últimos accesos:"
last -10

# 3. Bloqueo inmediato si es necesario
read -p "¿Bloquear todo el tráfico entrante? (s/N): " block_all
if [[ "$block_all" =~ ^[sS]$ ]]; then
    sudo ufw default deny incoming
    incident_log "Tráfico entrante bloqueado por emergencia"
    echo "   ✅ Tráfico entrante bloqueado"
fi

# 4. Recolección de evidencia
echo "3. Recolectando evidencia..."

# Logs del sistema
cp /var/log/nginx/access.log "$BACKUP_DIR/nginx_access.log" 2>/dev/null
cp /var/log/nginx/error.log "$BACKUP_DIR/nginx_error.log" 2>/dev/null
cp /var/log/auth.log "$BACKUP_DIR/auth.log" 2>/dev/null

# Estado del firewall
sudo ufw status numbered > "$BACKUP_DIR/ufw_status.txt"

# Procesos activos
ps aux > "$BACKUP_DIR/processes.txt"

# Conexiones de red
netstat -tuln > "$BACKUP_DIR/network_connections.txt"

incident_log "Evidencia recolectada en $BACKUP_DIR"

# 5. Análisis de logs
echo "4. Analizando logs por actividad sospechosa..."

if [ -f "/var/log/nginx/access.log" ]; then
    # IPs más activas en la última hora
    echo "   Top IPs última hora:" | tee -a "$BACKUP_DIR/analysis.txt"
    awk -v date="$(date -d '1 hour ago' '+%d/%b/%Y:%H')" '$4 > "["date {print $1}' /var/log/nginx/access.log | \
    sort | uniq -c | sort -nr | head -10 | tee -a "$BACKUP_DIR/analysis.txt"
    
    # Errores recientes
    echo "   Errores recientes:" | tee -a "$BACKUP_DIR/analysis.txt"
    grep " 5[0-9][0-9] " /var/log/nginx/access.log | tail -20 | tee -a "$BACKUP_DIR/analysis.txt"
fi

# 6. Verificación de integridad
echo "5. Verificando integridad del sistema..."
if command -v rkhunter >/dev/null 2>&1; then
    sudo rkhunter --check --skip-keypress --report-warnings-only > "$BACKUP_DIR/rkhunter.log" 2>&1
    incident_log "Verificación rkhunter completada"
fi

# 7. Reporte del incidente
echo "6. Generando reporte del incidente..."

cat > "$BACKUP_DIR/incident_report.txt" << EOF
REPORTE DE INCIDENTE DE SEGURIDAD
================================
Fecha: $(date)
Servidor: $(hostname)
IP Pública: $(curl -s https://api.ipify.org)

ESTADO DEL SISTEMA:
- Servicios críticos: $(systemctl is-active reparacion-pc nginx)
- Espacio en disco: $(df -h / | tail -1 | awk '{print $5}')  
- Memoria: $(free -h | grep Mem | awk '{printf "%.1f%", $3/$2 * 100.0}')
- Carga del sistema: $(uptime | awk '{print $NF}')

ANÁLISIS DE SEGURIDAD:
- Ver archivo analysis.txt para detalles
- Logs guardados en este directorio
- Verificación rkhunter: Ver rkhunter.log

ACCIONES TOMADAS:
- Backup de emergencia creado
- Evidencia recolectada
- $([ "$block_all" = "s" ] && echo "Tráfico entrante bloqueado" || echo "Sin bloqueos aplicados")

PRÓXIMOS PASOS:
1. Revisar logs detalladamente
2. Verificar integridad de archivos críticos
3. Actualizar reglas de firewall si es necesario
4. Considerar cambio de credenciales
5. Implementar medidas preventivas adicionales
EOF

incident_log "Reporte de incidente generado: $BACKUP_DIR/incident_report.txt"

echo
echo "✅ Respuesta a incidente completada"
echo "📁 Evidencia guardada en: $BACKUP_DIR"
echo "📄 Ver reporte: $BACKUP_DIR/incident_report.txt"
echo
echo "🚨 IMPORTANTE: Revisa todos los archivos generados antes de restablecer servicios"
```

### 🔒 Procedimiento de Bloqueo de Emergencia

```bash
#!/bin/bash
# Script: scripts/emergency-lockdown.sh

echo "🚨 PROCEDIMIENTO DE BLOQUEO DE EMERGENCIA 🚨"
echo

read -p "¿Estás seguro de continuar? (escribe 'EMERGENCIA'): " confirm
if [ "$confirm" != "EMERGENCIA" ]; then
    echo "Cancelado"
    exit 1
fi

# 1. Parar todos los servicios web
echo "1. Deteniendo servicios web..."
sudo systemctl stop reparacion-pc
sudo systemctl stop nginx
echo "   ✅ Servicios web detenidos"

# 2. Bloquear todo el tráfico
echo "2. Bloqueando tráfico..."
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default deny outgoing
sudo ufw allow out on lo
sudo ufw allow in on lo
sudo ufw allow out 22
sudo ufw --force enable
echo "   ✅ Firewall en modo lockdown"

# 3. Crear backup de emergencia
echo "3. Creando backup de emergencia..."
./scripts/backup.sh --silent
echo "   ✅ Backup creado"

# 4. Log del evento
echo "$(date '+%Y-%m-%d %H:%M:%S') - EMERGENCY LOCKDOWN ACTIVATED" >> logs/security.log

echo
echo "🔒 SISTEMA EN LOCKDOWN COMPLETO"
echo "Para restaurar:"
echo "1. Investiga la causa del problema"
echo "2. Ejecuta: sudo ufw --force reset"
echo "3. Ejecuta: ./scripts/firewall-setup.sh"
echo "4. Ejecuta: ./scripts/start.sh"
```

---

## 🔍 Auditoría de Seguridad

### 🧪 Script de Auditoría Completa

```bash
#!/bin/bash
# Script: scripts/security-audit.sh

AUDIT_DIR="audits/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$AUDIT_DIR"

echo "=== AUDITORÍA DE SEGURIDAD COMPLETA ==="
echo "Guardando resultados en: $AUDIT_DIR"
echo

# 1. Información del sistema
echo "1. Recopilando información del sistema..."
{
    echo "=== INFORMACIÓN DEL SISTEMA ==="
    echo "Fecha: $(date)"
    echo "Sistema: $(uname -a)"
    echo "Distribución: $(lsb_release -d 2>/dev/null || echo 'No disponible')"
    echo "Uptime: $(uptime)"
    echo "IP Pública: $(curl -s https://api.ipify.org)"
    echo
} > "$AUDIT_DIR/system_info.txt"

# 2. Auditoría de usuarios
echo "2. Auditando usuarios..."
{
    echo "=== USUARIOS DEL SISTEMA ==="
    echo "Usuarios con UID >= 1000:"
    awk -F: '$3 >= 1000 && $1 != "nobody" {print $1, $3, $5}' /etc/passwd
    echo
    echo "Usuarios con shell:"  
    grep -E "/bin/(bash|sh|zsh)" /etc/passwd
    echo
    echo "Últimos logins:"
    last -10
    echo
} > "$AUDIT_DIR/users_audit.txt"

# 3. Auditoría de servicios
echo "3. Auditando servicios..."
{
    echo "=== SERVICIOS ACTIVOS ==="
    systemctl list-units --type=service --state=running
    echo
    echo "=== PUERTOS ABIERTOS ==="
    netstat -tuln | grep LISTEN
    echo
} > "$AUDIT_DIR/services_audit.txt"

# 4. Auditoría de firewall
echo "4. Auditando firewall..."
{
    echo "=== CONFIGURACIÓN DEL FIREWALL ==="
    if command -v ufw >/dev/null 2>&1; then
        sudo ufw status verbose
    else
        echo "UFW no instalado"
    fi
    echo
    echo "=== FAIL2BAN STATUS ==="
    if command -v fail2ban-client >/dev/null 2>&1; then
        sudo fail2ban-client status
    else
        echo "Fail2ban no instalado"
    fi
    echo
} > "$AUDIT_DIR/firewall_audit.txt"

# 5. Auditoría de SSL
echo "5. Auditando SSL..."
{
    echo "=== CERTIFICADOS SSL ==="
    source .env 2>/dev/null
    if [ ! -z "$DOMAIN" ]; then
        echo "Dominio: $DOMAIN"
        if [ -f "/etc/letsencrypt/live/$DOMAIN/cert.pem" ]; then
            openssl x509 -in "/etc/letsencrypt/live/$DOMAIN/cert.pem" -noout -dates -subject
            echo
            openssl x509 -in "/etc/letsencrypt/live/$DOMAIN/cert.pem" -noout -text | grep "Signature Algorithm"
        else
            echo "Certificado no encontrado"
        fi
    else
        echo "Dominio no configurado"
    fi
    echo
} > "$AUDIT_DIR/ssl_audit.txt"

# 6. Auditoría de archivos críticos
echo "6. Auditando archivos críticos..."
{
    echo "=== PERMISOS DE ARCHIVOS CRÍTICOS ==="
    critical_files=(
        "/etc/passwd"
        "/etc/shadow"  
        "/etc/group"
        "/etc/gshadow"
        "/etc/ssh/sshd_config"
        "$PWD/.env"
        "$PWD/database/contacts.db"
    )
    
    for file in "${critical_files[@]}"; do
        if [ -f "$file" ]; then
            ls -la "$file"
        else
            echo "$file: No existe"
        fi
    done
    echo
} > "$AUDIT_DIR/files_audit.txt"

# 7. Análisis de logs
echo "7. Analizando logs..."
{
    echo "=== ANÁLISIS DE LOGS ==="
    echo "Errores SSH recientes:"
    grep -i "failed\|invalid\|refused" /var/log/auth.log 2>/dev/null | tail -10
    echo
    echo "Errores nginx recientes:"  
    tail -20 /var/log/nginx/error.log 2>/dev/null
    echo
    echo "Top 10 IPs en nginx (últimas 24h):"
    if [ -f "/var/log/nginx/access.log" ]; then
        awk -v date="$(date -d '1 day ago' '+%d/%b/%Y')" '$4 > "["date {print $1}' /var/log/nginx/access.log | \
        sort | uniq -c | sort -nr | head -10
    fi
    echo
} > "$AUDIT_DIR/logs_audit.txt"

# 8. Verificación de integridad
echo "8. Verificando integridad..."
{
    echo "=== VERIFICACIÓN DE INTEGRIDAD ==="
    
    # rkhunter
    if command -v rkhunter >/dev/null 2>&1; then
        echo "Ejecutando rkhunter..."
        sudo rkhunter --check --skip-keypress --report-warnings-only 2>&1
    else
        echo "rkhunter no instalado"
    fi
    echo
    
    # chkrootkit  
    if command -v chkrootkit >/dev/null 2>&1; then
        echo "Ejecutando chkrootkit..."
        sudo chkrootkit 2>&1 | grep -E "(INFECTED|SUSPICIOUS)"
    else
        echo "chkrootkit no instalado"
    fi
    echo
} > "$AUDIT_DIR/integrity_audit.txt"

# 9. Configuración de la aplicación
echo "9. Auditando configuración de la aplicación..."
{
    echo "=== CONFIGURACIÓN DE LA APLICACIÓN ==="
    
    if [ -f ".env" ]; then
        echo "Variables críticas configuradas:"
        grep -E "^(DOMAIN|EMAIL_|SSL_|JWT_|SESSION_|RECAPTCHA_)" .env | sed 's/=.*/=***/'
        echo
        
        echo "Verificando configuración crítica:"
        source .env
        [ ! -z "$JWT_SECRET" ] && echo "✅ JWT_SECRET configurado" || echo "❌ JWT_SECRET no configurado"
        [ ! -z "$SESSION_SECRET" ] && echo "✅ SESSION_SECRET configurado" || echo "❌ SESSION_SECRET no configurado"
        [ ! -z "$RECAPTCHA_SECRET_KEY" ] && echo "✅ RECAPTCHA configurado" || echo "❌ RECAPTCHA no configurado"
        [ ! -z "$EMAIL_USER" ] && echo "✅ EMAIL configurado" || echo "❌ EMAIL no configurado"
    else
        echo "Archivo .env no encontrado"
    fi
    echo
    
    echo "Estado de la base de datos:"
    if [ -f "database/contacts.db" ]; then
        sqlite3 database/contacts.db "PRAGMA integrity_check;" 2>/dev/null
        echo "Registros totales: $(sqlite3 database/contacts.db "SELECT COUNT(*) FROM contacts;" 2>/dev/null)"
    else
        echo "Base de datos no encontrada"
    fi
    echo
} > "$AUDIT_DIR/app_audit.txt"

# 10. Generar reporte resumen
echo "10. Generando reporte resumen..."
{
    echo "=========================================="
    echo "     REPORTE DE AUDITORÍA DE SEGURIDAD"
    echo "=========================================="
    echo "Fecha: $(date)"
    echo "Sistema: $(hostname)"
    echo
    
    echo "📊 RESUMEN EJECUTIVO:"
    echo "===================="
    
    # Servicios críticos
    echo "Servicios críticos:"
    systemctl is-active --quiet reparacion-pc && echo "  ✅ Aplicación: Funcionando" || echo "  ❌ Aplicación: Parada"
    systemctl is-active --quiet nginx && echo "  ✅ Nginx: Funcionando" || echo "  ❌ Nginx: Parado"
    
    # SSL
    source .env 2>/dev/null
    if [ ! -z "$DOMAIN" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/cert.pem" ]; then
        if openssl x509 -checkend 2592000 -noout -in "/etc/letsencrypt/live/$DOMAIN/cert.pem"; then
            echo "  ✅ SSL: Válido (>30 días)"
        else
            echo "  ⚠️  SSL: Expira pronto"
        fi
    else
        echo "  ❌ SSL: No configurado"
    fi
    
    # Firewall
    if sudo ufw status | grep -q "Status: active"; then
        echo "  ✅ Firewall: Activo"
    else
        echo "  ❌ Firewall: Inactivo"
    fi
    
    # Recursos del sistema
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 80 ]; then
        echo "  ✅ Espacio en disco: OK ($disk_usage%)"
    else
        echo "  ⚠️  Espacio en disco: Alto ($disk_usage%)"
    fi
    
    echo
    echo "🔍 HALLAZGOS IMPORTANTES:"
    echo "======================="
    
    # Verificar configuración crítica
    echo "Configuración de seguridad:"
    grep -q "^JWT_SECRET=" .env 2>/dev/null && echo "  ✅ JWT configurado" || echo "  ❌ JWT no configurado"
    grep -q "^RECAPTCHA_SECRET_KEY=" .env 2>/dev/null && echo "  ✅ reCAPTCHA configurado" || echo "  ❌ reCAPTCHA no configurado"
    
    # Verificar herramientas de seguridad
    command -v fail2ban-client >/dev/null && echo "  ✅ Fail2ban instalado" || echo "  ⚠️  Fail2ban no instalado"
    command -v rkhunter >/dev/null && echo "  ✅ rkhunter instalado" || echo "  ⚠️  rkhunter no instalado"
    
    echo
    echo "📋 ARCHIVOS GENERADOS:"
    echo "===================="
    ls -la "$AUDIT_DIR"/*.txt | awk '{print "  📄 " $NF}'
    
    echo
    echo "🚨 RECOMENDACIONES:"
    echo "================="
    echo "1. Revisar todos los archivos de auditoría generados"
    echo "2. Verificar logs por actividad sospechosa"
    echo "3. Actualizar sistema y aplicaciones regularmente"
    echo "4. Rotar credenciales cada 90 días"
    echo "5. Realizar auditorías de seguridad mensualmente"
    
} > "$AUDIT_DIR/audit_summary.txt"

echo
echo "✅ Auditoría de seguridad completada"
echo "📁 Resultados guardados en: $AUDIT_DIR"
echo "📄 Ver resumen: $AUDIT_DIR/audit_summary.txt"
echo
echo "🔍 Para revisar todos los resultados:"
echo "   cd $AUDIT_DIR && ls -la"
```

---

## 🎯 Checklist de Seguridad

### ✅ Lista de Verificación Diaria

```bash
# Ejecutar diariamente
./scripts/security-monitor.sh

# Verificaciones manuales:
# [ ] Servicios críticos funcionando
# [ ] Sin errores en logs
# [ ] SSL válido
# [ ] Backups completados
# [ ] Sin IPs sospechosas
```

### 🔄 Lista de Verificación Semanal

```bash
# Ejecutar semanalmente  
./scripts/security-dashboard.sh
./scripts/ssl-check.sh

# Verificaciones manuales:
# [ ] Actualizar sistema
# [ ] Revisar fail2ban logs
# [ ] Verificar integridad de archivos
# [ ] Revisar configuración de firewall
# [ ] Test de penetración básico
```

### 📊 Lista de Verificación Mensual

```bash
# Ejecutar mensualmente
./scripts/security-audit.sh

# Verificaciones manuales:
# [ ] Auditoría completa de seguridad
# [ ] Cambio de credenciales (opcional)
# [ ] Revisión de políticas de seguridad
# [ ] Test de recuperación de backups
# [ ] Actualización de documentación
```

---

Con esta configuración completa de seguridad, tu servicio de reparación PC estará protegido contra las amenazas más comunes y tendrás herramientas para detectar, responder y recuperarte de incidentes de seguridad. 🛡️

**Recuerda**: La seguridad es un proceso continuo, no una configuración única. Mantén siempre el sistema actualizado y revisa regularmente los logs y alertas.