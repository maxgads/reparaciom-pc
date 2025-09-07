#!/bin/bash

# Script de health check completo para el proyecto de reparación PC
# Verifica todos los componentes críticos del sistema

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Variables de control
HEALTH_STATUS=0
HEALTH_RESULTS=()

# Función para registrar resultado de test
record_result() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    if [ "$result" -eq 0 ]; then
        HEALTH_RESULTS+=("✅ $test_name: OK - $message")
    else
        HEALTH_RESULTS+=("❌ $test_name: FAILED - $message")
        HEALTH_STATUS=1
    fi
}

log_info "=== HEALTH CHECK COMPLETO DEL SISTEMA ==="
log_info "Fecha: $(date)"
echo

# 1. Verificar servicios del sistema
log_info "1. Verificando servicios del sistema..."

# Verificar servicio principal
if systemctl is-active --quiet reparacion-pc 2>/dev/null; then
    record_result "Servicio Principal" 0 "reparacion-pc está activo"
else
    record_result "Servicio Principal" 1 "reparacion-pc no está activo"
fi

# Verificar nginx
if systemctl is-active --quiet nginx 2>/dev/null; then
    record_result "Nginx" 0 "nginx está activo"
else
    record_result "Nginx" 1 "nginx no está activo"
fi

# 2. Verificar conectividad de red
log_info "2. Verificando conectividad de red..."

# Verificar conectividad a internet
if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
    record_result "Conectividad Internet" 0 "Conectado a internet"
else
    record_result "Conectividad Internet" 1 "Sin conexión a internet"
fi

# Verificar conectividad local
if ping -c 1 127.0.0.1 >/dev/null 2>&1; then
    record_result "Conectividad Local" 0 "Loopback funcionando"
else
    record_result "Conectividad Local" 1 "Problema con loopback"
fi

# 3. Verificar puertos
log_info "3. Verificando puertos..."

# Puerto 3000 (aplicación)
if netstat -tuln 2>/dev/null | grep ":3000 " >/dev/null; then
    record_result "Puerto 3000" 0 "Aplicación escuchando en puerto 3000"
else
    record_result "Puerto 3000" 1 "Puerto 3000 no está en uso"
fi

# Puerto 80 (HTTP)
if netstat -tuln 2>/dev/null | grep ":80 " >/dev/null; then
    record_result "Puerto 80" 0 "HTTP disponible en puerto 80"
else
    record_result "Puerto 80" 1 "Puerto 80 no disponible"
fi

# Puerto 443 (HTTPS)
if netstat -tuln 2>/dev/null | grep ":443 " >/dev/null; then
    record_result "Puerto 443" 0 "HTTPS disponible en puerto 443"
else
    record_result "Puerto 443" 1 "Puerto 443 no disponible"
fi

# 4. Health check de la aplicación
log_info "4. Verificando health check de la aplicación..."

if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    record_result "API Health Check" 0 "Endpoint /api/health responde correctamente"
else
    record_result "API Health Check" 1 "Endpoint /api/health no responde"
fi

# 5. Verificar SSL/TLS
log_info "5. Verificando SSL/TLS..."

# Cargar variables de entorno si existen
if [ -f ".env" ]; then
    source .env
fi

if [ ! -z "$DOMAIN" ]; then
    # Verificar certificado SSL
    if [ -f "/etc/letsencrypt/live/$DOMAIN/cert.pem" ]; then
        if openssl x509 -checkend 2592000 -noout -in "/etc/letsencrypt/live/$DOMAIN/cert.pem" 2>/dev/null; then
            record_result "Certificado SSL" 0 "Certificado válido por más de 30 días"
        else
            record_result "Certificado SSL" 1 "Certificado expira en menos de 30 días"
        fi
        
        # Verificar HTTPS
        if curl -sf "https://$DOMAIN/api/health" >/dev/null 2>&1; then
            record_result "HTTPS Endpoint" 0 "HTTPS funcionando correctamente"
        else
            record_result "HTTPS Endpoint" 1 "HTTPS no accesible"
        fi
    else
        record_result "Certificado SSL" 1 "Certificado no encontrado"
    fi
else
    record_result "Configuración SSL" 1 "Dominio no configurado"
fi

# 6. Verificar base de datos
log_info "6. Verificando base de datos..."

if [ -f "database/contacts.db" ]; then
    # Verificar integridad de la base de datos
    if sqlite3 database/contacts.db "PRAGMA integrity_check;" 2>/dev/null | grep -q "ok"; then
        record_result "Base de Datos Integridad" 0 "Integridad de la base de datos OK"
    else
        record_result "Base de Datos Integridad" 1 "Problema de integridad en la base de datos"
    fi
    
    # Verificar conectividad a la base de datos
    if sqlite3 database/contacts.db "SELECT COUNT(*) FROM contacts;" >/dev/null 2>&1; then
        CONTACT_COUNT=$(sqlite3 database/contacts.db "SELECT COUNT(*) FROM contacts;" 2>/dev/null)
        record_result "Base de Datos Conectividad" 0 "BD accesible, $CONTACT_COUNT contactos"
    else
        record_result "Base de Datos Conectividad" 1 "No se puede acceder a la base de datos"
    fi
else
    record_result "Base de Datos Archivo" 1 "Archivo de base de datos no encontrado"
fi

# 7. Verificar DNS dinámico
log_info "7. Verificando DNS dinámico..."

if [ ! -z "$DOMAIN" ] && [ ! -z "$DUCKDNS_DOMAIN" ]; then
    # Verificar resolución DNS
    RESOLVED_IP=$(dig +short "$DOMAIN" @8.8.8.8 2>/dev/null | tail -n1)
    CURRENT_IP=$(curl -s https://api.ipify.org 2>/dev/null)
    
    if [ ! -z "$RESOLVED_IP" ] && [ ! -z "$CURRENT_IP" ]; then
        if [ "$RESOLVED_IP" = "$CURRENT_IP" ]; then
            record_result "DNS Sincronización" 0 "DNS sincronizado correctamente"
        else
            record_result "DNS Sincronización" 1 "DNS no sincronizado (IP: $CURRENT_IP, DNS: $RESOLVED_IP)"
        fi
    else
        record_result "DNS Resolución" 1 "Error al resolver DNS o detectar IP"
    fi
else
    record_result "DNS Configuración" 1 "DNS dinámico no configurado"
fi

# 8. Verificar recursos del sistema
log_info "8. Verificando recursos del sistema..."

# Espacio en disco
DISK_USAGE=$(df / 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    record_result "Espacio en Disco" 0 "Uso de disco: ${DISK_USAGE}%"
else
    record_result "Espacio en Disco" 1 "Uso de disco crítico: ${DISK_USAGE}%"
fi

# Memoria
MEM_USAGE=$(free 2>/dev/null | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ "$MEM_USAGE" -lt 85 ]; then
    record_result "Memoria" 0 "Uso de memoria: ${MEM_USAGE}%"
else
    record_result "Memoria" 1 "Uso de memoria alto: ${MEM_USAGE}%"
fi

# Load average
LOAD_AVG=$(uptime | awk '{print $NF}')
# Obtener número de CPUs para contexto
CPU_CORES=$(nproc 2>/dev/null || echo "1")
if (( $(echo "$LOAD_AVG < $CPU_CORES * 2" | bc -l 2>/dev/null || echo "1") )); then
    record_result "Carga del Sistema" 0 "Load average: $LOAD_AVG (CPUs: $CPU_CORES)"
else
    record_result "Carga del Sistema" 1 "Load average alto: $LOAD_AVG (CPUs: $CPU_CORES)"
fi

# 9. Verificar configuración crítica
log_info "9. Verificando configuración crítica..."

if [ -f ".env" ]; then
    record_result "Archivo .env" 0 "Archivo .env presente"
    
    # Verificar variables críticas
    source .env
    
    [ ! -z "$JWT_SECRET" ] && record_result "JWT_SECRET" 0 "JWT_SECRET configurado" || record_result "JWT_SECRET" 1 "JWT_SECRET no configurado"
    [ ! -z "$SESSION_SECRET" ] && record_result "SESSION_SECRET" 0 "SESSION_SECRET configurado" || record_result "SESSION_SECRET" 1 "SESSION_SECRET no configurado"
    [ ! -z "$EMAIL_USER" ] && record_result "EMAIL_USER" 0 "EMAIL_USER configurado" || record_result "EMAIL_USER" 1 "EMAIL_USER no configurado"
    [ ! -z "$RECAPTCHA_SECRET_KEY" ] && record_result "RECAPTCHA" 0 "reCAPTCHA configurado" || record_result "RECAPTCHA" 1 "reCAPTCHA no configurado"
else
    record_result "Archivo .env" 1 "Archivo .env no encontrado"
fi

# 10. Verificar logs por errores recientes
log_info "10. Verificando logs por errores recientes..."

if [ -f "logs/app.log" ]; then
    ERROR_COUNT=$(grep -i error logs/app.log 2>/dev/null | tail -100 | wc -l)
    if [ "$ERROR_COUNT" -lt 10 ]; then
        record_result "Logs de Errores" 0 "$ERROR_COUNT errores en los últimos logs"
    else
        record_result "Logs de Errores" 1 "$ERROR_COUNT errores recientes detectados"
    fi
else
    record_result "Archivo de Logs" 1 "Archivo de logs no encontrado"
fi

# Verificar logs de nginx si están disponibles
if [ -f "/var/log/nginx/error.log" ]; then
    NGINX_ERRORS=$(tail -100 /var/log/nginx/error.log 2>/dev/null | grep -i error | wc -l)
    if [ "$NGINX_ERRORS" -lt 5 ]; then
        record_result "Nginx Error Logs" 0 "$NGINX_ERRORS errores en logs de nginx"
    else
        record_result "Nginx Error Logs" 1 "$NGINX_ERRORS errores recientes en nginx"
    fi
fi

# 11. Verificar firewall y seguridad
log_info "11. Verificando firewall y seguridad..."

# Verificar UFW
if command -v ufw >/dev/null 2>&1; then
    if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
        record_result "Firewall UFW" 0 "Firewall activo"
    else
        record_result "Firewall UFW" 1 "Firewall inactivo"
    fi
else
    record_result "Firewall UFW" 1 "UFW no instalado"
fi

# Verificar fail2ban
if command -v fail2ban-client >/dev/null 2>&1; then
    if systemctl is-active --quiet fail2ban 2>/dev/null; then
        record_result "Fail2ban" 0 "Fail2ban activo"
    else
        record_result "Fail2ban" 1 "Fail2ban inactivo"
    fi
else
    record_result "Fail2ban" 1 "Fail2ban no instalado"
fi

# 12. Verificar backups
log_info "12. Verificando backups..."

if [ -d "backups" ]; then
    RECENT_BACKUPS=$(find backups/ -name "backup_*.tar.gz" -mtime -7 2>/dev/null | wc -l)
    if [ "$RECENT_BACKUPS" -gt 0 ]; then
        record_result "Backups Recientes" 0 "$RECENT_BACKUPS backups en los últimos 7 días"
    else
        record_result "Backups Recientes" 1 "No hay backups recientes"
    fi
    
    TOTAL_BACKUPS=$(find backups/ -name "backup_*.tar.gz" 2>/dev/null | wc -l)
    record_result "Backups Total" 0 "$TOTAL_BACKUPS backups disponibles"
else
    record_result "Directorio Backups" 1 "Directorio de backups no existe"
fi

echo
echo "=== RESUMEN DE HEALTH CHECK ==="
echo

# Mostrar todos los resultados
for result in "${HEALTH_RESULTS[@]}"; do
    echo "$result"
done

echo
echo "================================="

# Determinar estado general
if [ $HEALTH_STATUS -eq 0 ]; then
    log_success "🎉 ESTADO GENERAL: SISTEMA SALUDABLE"
    echo "   Todos los componentes críticos funcionan correctamente"
else
    log_error "⚠️  ESTADO GENERAL: PROBLEMAS DETECTADOS"
    echo "   Revisa los elementos marcados como FAILED"
    echo "   Ejecuta los scripts de diagnóstico para más detalles:"
    echo "   • ./scripts/diagnostics.sh"
    echo "   • ./scripts/security-audit.sh"
fi

echo
echo "📊 INFORMACIÓN ADICIONAL:"
echo "   Uptime del sistema: $(uptime -p 2>/dev/null || echo 'No disponible')"
echo "   Load average: $(uptime | awk '{print $NF}' 2>/dev/null || echo 'No disponible')"
echo "   Memoria libre: $(free -h 2>/dev/null | grep Mem | awk '{print $4}' || echo 'No disponible')"
echo "   Espacio libre: $(df -h / 2>/dev/null | tail -1 | awk '{print $4}' || echo 'No disponible')"

if [ ! -z "$DOMAIN" ]; then
    echo "   Dominio: $DOMAIN"
fi

# Guardar resultado en log
HEALTH_LOG="logs/health-check.log"
mkdir -p logs
echo "$(date '+%Y-%m-%d %H:%M:%S') - Health Check: $([ $HEALTH_STATUS -eq 0 ] && echo 'PASS' || echo 'FAIL') - $(grep -c "❌" <<< "${HEALTH_RESULTS[*]}") errores detectados" >> "$HEALTH_LOG"

echo
log_info "Log de health check guardado en: $HEALTH_LOG"
echo

exit $HEALTH_STATUS