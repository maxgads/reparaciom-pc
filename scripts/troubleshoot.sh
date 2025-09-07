#!/bin/bash

# Script de troubleshooting automático para el proyecto de reparación PC
# Detecta y soluciona problemas comunes automáticamente

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_fix() { echo -e "${CYAN}[FIX]${NC} $1"; }

# Variables de control
ISSUES_FOUND=0
FIXES_APPLIED=0
AUTO_FIX=${1:-"interactive"} # "auto" para modo automático, "interactive" por defecto

# Función para aplicar fix automático o preguntar al usuario
apply_fix() {
    local description="$1"
    local fix_command="$2"
    
    if [ "$AUTO_FIX" = "auto" ]; then
        log_fix "Aplicando fix automático: $description"
        eval "$fix_command"
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
    else
        echo
        read -p "¿Aplicar fix para: $description? (s/N): " apply
        if [[ "$apply" =~ ^[sS]$ ]]; then
            log_fix "Aplicando fix: $description"
            eval "$fix_command"
            FIXES_APPLIED=$((FIXES_APPLIED + 1))
        else
            log_info "Fix omitido: $description"
        fi
    fi
}

log_info "=== SISTEMA DE TROUBLESHOOTING AUTOMÁTICO ==="
log_info "Modo: $AUTO_FIX"
log_info "Fecha: $(date)"
echo

# 1. Verificar y solucionar problemas de servicios
log_info "1. Verificando servicios..."

# Servicio principal
if ! systemctl is-active --quiet reparacion-pc 2>/dev/null; then
    log_error "Servicio reparacion-pc no está activo"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    
    # Verificar si el servicio existe
    if systemctl list-unit-files | grep -q "reparacion-pc.service"; then
        apply_fix "Reiniciar servicio reparacion-pc" "systemctl start reparacion-pc"
        
        # Verificar si el reinicio fue exitoso
        sleep 3
        if systemctl is-active --quiet reparacion-pc; then
            log_success "Servicio reparacion-pc reiniciado exitosamente"
        else
            log_error "Error al reiniciar servicio reparacion-pc, verificando logs..."
            journalctl -u reparacion-pc --lines=10 --no-pager
        fi
    else
        log_error "Servicio reparacion-pc no está configurado"
        apply_fix "Crear y habilitar servicio systemd" "
            sudo cp config/reparacion-pc.service /etc/systemd/system/ 2>/dev/null || echo 'Archivo de servicio no encontrado';
            sudo systemctl daemon-reload;
            sudo systemctl enable reparacion-pc;
            sudo systemctl start reparacion-pc
        "
    fi
else
    log_success "Servicio reparacion-pc está activo"
fi

# Nginx
if ! systemctl is-active --quiet nginx 2>/dev/null; then
    log_error "Nginx no está activo"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    
    # Verificar configuración de nginx
    if nginx -t 2>/dev/null; then
        apply_fix "Reiniciar nginx" "systemctl start nginx"
    else
        log_error "Error en configuración de nginx"
        apply_fix "Restaurar configuración básica de nginx" "
            sudo rm -f /etc/nginx/sites-enabled/reparacion-pc;
            sudo nginx -t;
            systemctl restart nginx
        "
    fi
else
    log_success "Nginx está activo"
fi

# 2. Verificar y solucionar problemas de puertos
log_info "2. Verificando puertos..."

# Verificar puerto 3000
if ! netstat -tuln 2>/dev/null | grep ":3000 " >/dev/null; then
    log_error "Puerto 3000 no está en uso"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    
    # Verificar si Node.js está corriendo
    if ! pgrep -f "node.*server.js" >/dev/null; then
        apply_fix "Iniciar aplicación Node.js manualmente" "
            cd $PWD;
            nohup node backend/server.js > logs/app.log 2>&1 &
        "
    else
        log_warning "Node.js está corriendo pero no escucha en puerto 3000"
    fi
fi

# Verificar conflictos de puertos
PORT_80_PID=$(lsof -ti:80 2>/dev/null | head -1)
if [ ! -z "$PORT_80_PID" ] && ! ps -p "$PORT_80_PID" -o comm= | grep -q nginx; then
    log_error "Puerto 80 ocupado por proceso diferente a nginx (PID: $PORT_80_PID)"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    apply_fix "Terminar proceso que ocupa puerto 80" "kill -9 $PORT_80_PID"
fi

# 3. Verificar y solucionar problemas de conectividad
log_info "3. Verificando conectividad..."

# Conectividad a internet
if ! ping -c 1 8.8.8.8 >/dev/null 2>&1; then
    log_error "Sin conectividad a internet"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    
    apply_fix "Reiniciar interfaz de red" "
        sudo systemctl restart NetworkManager 2>/dev/null ||
        sudo service network-manager restart 2>/dev/null ||
        sudo service networking restart 2>/dev/null ||
        echo 'No se pudo reiniciar la red automáticamente'
    "
fi

# Health check de aplicación
if ! curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    log_error "Health check de aplicación falla"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    
    # Verificar si la aplicación está corriendo
    if pgrep -f "node.*server.js" >/dev/null; then
        log_warning "Aplicación corriendo pero health check falla"
        apply_fix "Reiniciar aplicación Node.js" "
            pkill -f 'node.*server.js';
            sleep 2;
            cd $PWD;
            nohup node backend/server.js > logs/app.log 2>&1 &
        "
    fi
fi

# 4. Verificar y solucionar problemas de SSL
log_info "4. Verificando SSL..."

if [ -f ".env" ]; then
    source .env
    
    if [ ! -z "$DOMAIN" ]; then
        # Verificar certificado SSL
        if [ ! -f "/etc/letsencrypt/live/$DOMAIN/cert.pem" ]; then
            log_error "Certificado SSL no encontrado para $DOMAIN"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
            apply_fix "Generar certificado SSL" "./scripts/ssl-setup.sh"
        else
            # Verificar si el certificado expira pronto
            if ! openssl x509 -checkend 2592000 -noout -in "/etc/letsencrypt/live/$DOMAIN/cert.pem" 2>/dev/null; then
                log_error "Certificado SSL expira pronto"
                ISSUES_FOUND=$((ISSUES_FOUND + 1))
                apply_fix "Renovar certificado SSL" "certbot renew --nginx"
            fi
        fi
        
        # Verificar HTTPS
        if ! curl -sf "https://$DOMAIN/api/health" >/dev/null 2>&1; then
            log_error "HTTPS no es accesible"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
            # Este problema generalmente requiere revisión manual
            log_info "Verifica configuración DNS y port forwarding"
        fi
    fi
fi

# 5. Verificar y solucionar problemas de base de datos
log_info "5. Verificando base de datos..."

if [ ! -f "database/contacts.db" ]; then
    log_error "Archivo de base de datos no encontrado"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    apply_fix "Crear base de datos" "
        mkdir -p database;
        sqlite3 database/contacts.db < database/schema.sql 2>/dev/null ||
        sqlite3 database/contacts.db 'CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            equipment_type TEXT NOT NULL,
            problem_description TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT \"new\"
        );'
    "
else
    # Verificar integridad de la base de datos
    if ! sqlite3 database/contacts.db "PRAGMA integrity_check;" 2>/dev/null | grep -q "ok"; then
        log_error "Base de datos corrupta"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        apply_fix "Reparar base de datos desde backup" "
            cp database/contacts.db database/contacts.db.corrupted;
            if [ -f 'backups/latest_backup/contacts.db' ]; then
                cp backups/latest_backup/contacts.db database/;
            else
                sqlite3 database/contacts.db '.recover' | sqlite3 database/contacts_recovered.db;
                mv database/contacts.db database/contacts.db.old;
                mv database/contacts_recovered.db database/contacts.db;
            fi
        "
    fi
fi

# 6. Verificar y solucionar problemas de configuración
log_info "6. Verificando configuración..."

if [ ! -f ".env" ]; then
    log_error "Archivo .env no encontrado"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    apply_fix "Crear archivo .env desde ejemplo" "cp .env.example .env"
else
    # Verificar variables críticas
    source .env
    
    if [ -z "$JWT_SECRET" ] || [ ${#JWT_SECRET} -lt 32 ]; then
        log_error "JWT_SECRET no configurado o muy corto"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        apply_fix "Generar JWT_SECRET seguro" "
            JWT_NEW=\$(openssl rand -base64 32);
            sed -i 's/JWT_SECRET=.*/JWT_SECRET='\$JWT_NEW'/' .env
        "
    fi
    
    if [ -z "$SESSION_SECRET" ] || [ ${#SESSION_SECRET} -lt 32 ]; then
        log_error "SESSION_SECRET no configurado o muy corto"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        apply_fix "Generar SESSION_SECRET seguro" "
            SESSION_NEW=\$(openssl rand -base64 32);
            sed -i 's/SESSION_SECRET=.*/SESSION_SECRET='\$SESSION_NEW'/' .env
        "
    fi
fi

# 7. Verificar y solucionar problemas de permisos
log_info "7. Verificando permisos..."

# Verificar permisos de scripts
if [ ! -x "scripts/backup.sh" ] || [ ! -x "scripts/start.sh" ]; then
    log_error "Scripts sin permisos de ejecución"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    apply_fix "Corregir permisos de scripts" "chmod +x scripts/*.sh"
fi

# Verificar permisos de base de datos
if [ -f "database/contacts.db" ] && [ ! -w "database/contacts.db" ]; then
    log_error "Base de datos sin permisos de escritura"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    apply_fix "Corregir permisos de base de datos" "
        chmod 644 database/contacts.db;
        chown \$USER:\$USER database/contacts.db
    "
fi

# Verificar permisos de logs
if [ ! -w "logs/" ] 2>/dev/null; then
    log_error "Directorio de logs sin permisos de escritura"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    apply_fix "Crear y configurar directorio de logs" "
        mkdir -p logs;
        chmod 755 logs;
        chown \$USER:\$USER logs
    "
fi

# 8. Verificar y solucionar problemas de recursos
log_info "8. Verificando recursos del sistema..."

# Espacio en disco
DISK_USAGE=$(df / 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//' || echo "0")
if [ "$DISK_USAGE" -gt 95 ]; then
    log_error "Espacio en disco crítico: ${DISK_USAGE}%"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    apply_fix "Limpiar archivos temporales y logs antiguos" "
        find logs/ -name '*.log' -mtime +7 -delete 2>/dev/null || true;
        find backups/ -name 'backup_*.tar.gz' -mtime +30 -delete 2>/dev/null || true;
        npm cache clean --force 2>/dev/null || true;
        sudo journalctl --vacuum-time=7d 2>/dev/null || true
    "
fi

# Memoria
MEM_USAGE=$(free 2>/dev/null | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}' || echo "0")
if [ "$MEM_USAGE" -gt 95 ]; then
    log_error "Memoria crítica: ${MEM_USAGE}%"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    apply_fix "Reiniciar servicios para liberar memoria" "
        systemctl restart reparacion-pc;
        systemctl restart nginx
    "
fi

# 9. Verificar y solucionar problemas de DNS
log_info "9. Verificando DNS..."

if [ ! -z "$DOMAIN" ] && [ ! -z "$DUCKDNS_DOMAIN" ]; then
    CURRENT_IP=$(curl -s https://api.ipify.org 2>/dev/null)
    RESOLVED_IP=$(dig +short "$DOMAIN" @8.8.8.8 2>/dev/null | tail -n1)
    
    if [ ! -z "$CURRENT_IP" ] && [ ! -z "$RESOLVED_IP" ] && [ "$CURRENT_IP" != "$RESOLVED_IP" ]; then
        log_error "DNS no sincronizado (IP: $CURRENT_IP, DNS: $RESOLVED_IP)"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        apply_fix "Actualizar DNS dinámico" "./scripts/update-duckdns.sh"
    fi
fi

# 10. Verificar dependencias de Node.js
log_info "10. Verificando dependencias..."

if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    log_error "Dependencias de Node.js no instaladas correctamente"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    apply_fix "Reinstalar dependencias" "
        rm -rf node_modules package-lock.json;
        npm install
    "
fi

# Verificar vulnerabilidades de seguridad
if npm audit 2>/dev/null | grep -q "vulnerabilities"; then
    log_warning "Vulnerabilidades de seguridad detectadas en dependencias"
    apply_fix "Corregir vulnerabilidades automáticamente" "npm audit fix"
fi

echo
echo "=== RESUMEN DE TROUBLESHOOTING ==="
echo
log_info "Problemas encontrados: $ISSUES_FOUND"
log_info "Fixes aplicados: $FIXES_APPLIED"
echo

if [ $ISSUES_FOUND -eq 0 ]; then
    log_success "🎉 No se encontraron problemas críticos"
    echo "   El sistema parece estar funcionando correctamente"
else
    if [ $FIXES_APPLIED -gt 0 ]; then
        log_success "✅ Se aplicaron $FIXES_APPLIED fixes de $ISSUES_FOUND problemas"
        echo
        log_info "Ejecutando health check para verificar fixes..."
        sleep 3
        ./scripts/health-check.sh
    else
        log_warning "⚠️  Se encontraron $ISSUES_FOUND problemas pero no se aplicaron fixes"
        echo "   Ejecuta el script en modo automático: ./scripts/troubleshoot.sh auto"
        echo "   O revisa los problemas manualmente"
    fi
fi

# Recomendaciones adicionales
echo
log_info "🔧 RECOMENDACIONES ADICIONALES:"
echo
echo "• Ejecuta health check regularmente: ./scripts/health-check.sh"
echo "• Verifica logs de errores: tail -f logs/app.log | grep -i error"
echo "• Mantén el sistema actualizado: ./scripts/system-update.sh"
echo "• Realiza backups regulares: ./scripts/backup.sh"
echo "• Monitorea recursos del sistema: ./scripts/dashboard.sh"

# Crear log de troubleshooting
mkdir -p logs
echo "$(date '+%Y-%m-%d %H:%M:%S') - Troubleshooting: $ISSUES_FOUND problemas, $FIXES_APPLIED fixes aplicados" >> logs/troubleshoot.log

echo
log_info "Log de troubleshooting guardado en: logs/troubleshoot.log"

if [ $ISSUES_FOUND -gt $FIXES_APPLIED ]; then
    exit 1
else
    exit 0
fi