#!/bin/bash

# Script de backup automático para el proyecto de reparación PC
# Incluye base de datos, configuración, logs y archivos estáticos

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

# Configuración
BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_reparacion_pc_$DATE"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
MAX_BACKUPS=30  # Mantener últimos 30 backups

# Cargar variables de entorno si existe .env
if [ -f ".env" ]; then
    source .env
fi

log_info "=== Iniciando Backup del Sistema ==="
log_info "Backup: $BACKUP_NAME"
log_info "Fecha: $(date)"
echo

# Crear directorio de backup
mkdir -p "$BACKUP_PATH"

# 1. Backup de base de datos
log_info "1. Realizando backup de base de datos..."
if [ -f "database/contacts.db" ]; then
    # Backup con integridad verificada
    sqlite3 database/contacts.db ".backup '$BACKUP_PATH/contacts.db'"
    
    # Exportar como SQL también
    sqlite3 database/contacts.db ".dump" > "$BACKUP_PATH/contacts.sql"
    
    # Verificar integridad del backup
    if sqlite3 "$BACKUP_PATH/contacts.db" "PRAGMA integrity_check;" | grep -q "ok"; then
        log_success "Backup de base de datos completado y verificado"
        
        # Estadísticas de la base de datos
        TOTAL_CONTACTS=$(sqlite3 database/contacts.db "SELECT COUNT(*) FROM contacts;")
        BLOCKED_IPS=$(sqlite3 database/contacts.db "SELECT COUNT(*) FROM blocked_ips;")
        echo "  📊 Contactos: $TOTAL_CONTACTS"
        echo "  🚫 IPs bloqueadas: $BLOCKED_IPS"
    else
        log_error "Error en la integridad del backup de base de datos"
        exit 1
    fi
else
    log_warning "Base de datos no encontrada"
fi

# 2. Backup de archivos de configuración
log_info "2. Realizando backup de configuración..."
CONFIG_DIR="$BACKUP_PATH/config"
mkdir -p "$CONFIG_DIR"

# Copiar archivos de configuración críticos
[ -f ".env" ] && cp .env "$CONFIG_DIR/"
[ -f ".env.example" ] && cp .env.example "$CONFIG_DIR/"
[ -f "package.json" ] && cp package.json "$CONFIG_DIR/"
[ -f "package-lock.json" ] && cp package-lock.json "$CONFIG_DIR/"

# Configuración de nginx si existe
if [ -f "/etc/nginx/sites-available/reparacion-pc" ]; then
    sudo cp /etc/nginx/sites-available/reparacion-pc "$CONFIG_DIR/nginx.conf" 2>/dev/null || true
fi

# Configuración del servicio systemd
if [ -f "/etc/systemd/system/reparacion-pc.service" ]; then
    sudo cp /etc/systemd/system/reparacion-pc.service "$CONFIG_DIR/" 2>/dev/null || true
fi

log_success "Backup de configuración completado"

# 3. Backup de logs
log_info "3. Realizando backup de logs..."
LOGS_DIR="$BACKUP_PATH/logs"
mkdir -p "$LOGS_DIR"

# Logs de la aplicación
if [ -d "logs" ]; then
    cp -r logs/* "$LOGS_DIR/" 2>/dev/null || true
fi

# Logs del sistema (últimos 7 días)
if command -v journalctl >/dev/null 2>&1; then
    journalctl -u reparacion-pc --since "7 days ago" > "$LOGS_DIR/systemd.log" 2>/dev/null || true
    journalctl -u nginx --since "7 days ago" > "$LOGS_DIR/nginx.log" 2>/dev/null || true
fi

# Logs de nginx si existen
if [ -d "/var/log/nginx" ]; then
    sudo cp /var/log/nginx/access.log "$LOGS_DIR/nginx_access.log" 2>/dev/null || true
    sudo cp /var/log/nginx/error.log "$LOGS_DIR/nginx_error.log" 2>/dev/null || true
fi

log_success "Backup de logs completado"

# 4. Backup de archivos estáticos críticos
log_info "4. Realizando backup de archivos estáticos..."
STATIC_DIR="$BACKUP_PATH/static"
mkdir -p "$STATIC_DIR"

# Frontend completo
if [ -d "frontend" ]; then
    cp -r frontend "$STATIC_DIR/"
fi

# Backend (código fuente)
if [ -d "backend" ]; then
    cp -r backend "$STATIC_DIR/"
fi

# Scripts
if [ -d "scripts" ]; then
    cp -r scripts "$STATIC_DIR/"
fi

# Documentación
if [ -d "docs" ]; then
    cp -r docs "$STATIC_DIR/"
fi

log_success "Backup de archivos estáticos completado"

# 5. Backup de certificados SSL
log_info "5. Verificando certificados SSL..."
SSL_DIR="$BACKUP_PATH/ssl"
mkdir -p "$SSL_DIR"

if [ ! -z "$DOMAIN" ] && [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    # Información del certificado (no el certificado en sí por seguridad)
    openssl x509 -in "/etc/letsencrypt/live/$DOMAIN/cert.pem" -text -noout > "$SSL_DIR/cert_info.txt" 2>/dev/null || true
    echo "Dominio: $DOMAIN" > "$SSL_DIR/ssl_config.txt"
    echo "Fecha backup: $(date)" >> "$SSL_DIR/ssl_config.txt"
    log_success "Información de certificados SSL guardada"
else
    log_warning "Certificados SSL no encontrados o dominio no configurado"
fi

# 6. Crear archivo de información del backup
log_info "6. Creando información del backup..."
cat > "$BACKUP_PATH/backup_info.txt" << EOF
=== INFORMACIÓN DEL BACKUP ===
Fecha: $(date)
Servidor: $(hostname)
Usuario: $(whoami)
Dominio: ${DOMAIN:-"No configurado"}
Puerto: ${PORT:-"No configurado"}
Versión Node.js: $(node --version 2>/dev/null || echo "No instalado")
Sistema Operativo: $(uname -a)

=== CONTENIDO ===
- Base de datos SQLite (contacts.db + SQL dump)
- Archivos de configuración (.env, package.json, nginx)
- Logs del sistema (últimos 7 días)
- Código fuente completo (frontend, backend, scripts)
- Información de certificados SSL
- Este archivo de información

=== ESTADÍSTICAS ===
Total contactos: ${TOTAL_CONTACTS:-0}
IPs bloqueadas: ${BLOCKED_IPS:-0}
Tamaño del backup: $(du -sh "$BACKUP_PATH" | cut -f1)

=== RESTAURACIÓN ===
Para restaurar este backup:
1. Detener servicios: sudo systemctl stop reparacion-pc nginx
2. Restaurar archivos de configuración
3. Restaurar base de datos: sqlite3 database/contacts.db ".restore '$BACKUP_PATH/contacts.db'"
4. Restaurar código fuente
5. Reiniciar servicios: sudo systemctl start reparacion-pc nginx
EOF

# 7. Comprimir backup
log_info "7. Comprimiendo backup..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"

if [ -f "${BACKUP_NAME}.tar.gz" ]; then
    COMPRESSED_SIZE=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
    rm -rf "$BACKUP_NAME"  # Eliminar carpeta sin comprimir
    log_success "Backup comprimido: ${BACKUP_NAME}.tar.gz ($COMPRESSED_SIZE)"
else
    log_error "Error al comprimir backup"
    exit 1
fi

cd - > /dev/null

# 8. Limpiar backups antiguos
log_info "8. Limpiando backups antiguos..."
cd "$BACKUP_DIR"
BACKUP_COUNT=$(ls -1 backup_reparacion_pc_*.tar.gz 2>/dev/null | wc -l)

if [ $BACKUP_COUNT -gt $MAX_BACKUPS ]; then
    BACKUPS_TO_DELETE=$((BACKUP_COUNT - MAX_BACKUPS))
    ls -1t backup_reparacion_pc_*.tar.gz | tail -n $BACKUPS_TO_DELETE | xargs rm -f
    log_info "Eliminados $BACKUPS_TO_DELETE backups antiguos"
fi

log_info "Backups mantenidos: $(ls -1 backup_reparacion_pc_*.tar.gz 2>/dev/null | wc -l)/$MAX_BACKUPS"
cd - > /dev/null

# 9. Verificar integridad del backup final
log_info "9. Verificando integridad del backup..."
if tar -tzf "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" >/dev/null 2>&1; then
    log_success "Verificación de integridad exitosa"
else
    log_error "Error en la verificación de integridad"
    exit 1
fi

# 10. Registro en log de backups
log_info "10. Registrando en log de backups..."
BACKUP_LOG="$BACKUP_DIR/backup.log"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Backup completado: ${BACKUP_NAME}.tar.gz ($COMPRESSED_SIZE)" >> "$BACKUP_LOG"

# Resumen final
echo
log_success "=== BACKUP COMPLETADO EXITOSAMENTE ==="
echo "📁 Archivo: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
echo "📊 Tamaño: $COMPRESSED_SIZE"
echo "⏰ Duración: $(date)"
echo "💾 Ubicación: $(realpath $BACKUP_DIR)/${BACKUP_NAME}.tar.gz"
echo
log_info "Para restaurar: tar -xzf $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
log_info "Ver backups: ls -la $BACKUP_DIR/"

# Si estamos en modo automatico (cron), ser más silencioso
if [ "$1" = "--silent" ]; then
    exit 0
fi

echo
log_info "Backup completado correctamente. Presiona Enter para continuar..."
read