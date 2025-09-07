#!/bin/bash

# Script para iniciar el servidor de reparación PC
# Incluye verificaciones de salud y monitoreo

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

# Función para verificar si un servicio está corriendo
check_service() {
    if systemctl is-active --quiet $1; then
        log_success "$1 está corriendo"
        return 0
    else
        log_error "$1 no está corriendo"
        return 1
    fi
}

# Función para verificar puertos
check_port() {
    if netstat -tuln | grep ":$1 " > /dev/null; then
        log_success "Puerto $1 está en uso"
        return 0
    else
        log_warning "Puerto $1 no está en uso"
        return 1
    fi
}

# Función de health check
health_check() {
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s http://localhost:3000/api/health > /dev/null 2>&1; then
            log_success "Servidor respondiendo correctamente"
            return 0
        fi
        
        attempt=$((attempt + 1))
        log_info "Esperando respuesta del servidor... (intento $attempt/$max_attempts)"
        sleep 2
    done
    
    log_error "El servidor no responde después de $max_attempts intentos"
    return 1
}

log_info "=== Iniciando Sistema de Reparación PC ==="
echo

# Verificar archivo .env
if [ ! -f ".env" ]; then
    log_error "Archivo .env no encontrado"
    log_info "Copia .env.example a .env y configura las variables"
    exit 1
fi

# Cargar variables de entorno
source .env

# Verificar variables críticas
if [ -z "$PORT" ] || [ -z "$DOMAIN" ] || [ -z "$EMAIL_USER" ]; then
    log_error "Variables de entorno críticas no configuradas"
    log_info "Revisa el archivo .env y configura todas las variables necesarias"
    exit 1
fi

log_success "Archivo .env configurado correctamente"

# Verificar dependencias de Node.js
if [ ! -d "node_modules" ]; then
    log_warning "Dependencias no instaladas, instalando..."
    npm install
fi

# Verificar base de datos
log_info "Verificando base de datos..."
if [ ! -f "database/contacts.db" ]; then
    log_warning "Base de datos no encontrada, creando..."
    mkdir -p database
    sqlite3 database/contacts.db < database/schema.sql 2>/dev/null || true
fi

# Crear directorio de logs
mkdir -p logs

# Verificar certificados SSL
log_info "Verificando certificados SSL..."
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log_warning "Certificados SSL no encontrados"
    log_info "Ejecuta './scripts/ssl-setup.sh' para configurar SSL"
else
    # Verificar si el certificado expira pronto (menos de 30 días)
    if ! openssl x509 -checkend 2592000 -noout -in "/etc/letsencrypt/live/$DOMAIN/cert.pem" >/dev/null; then
        log_warning "El certificado SSL expira pronto, renovando..."
        sudo certbot renew --nginx --quiet
    fi
    log_success "Certificados SSL válidos"
fi

# Verificar configuración de nginx
log_info "Verificando configuración de nginx..."
if sudo nginx -t >/dev/null 2>&1; then
    log_success "Configuración de nginx válida"
else
    log_error "Error en configuración de nginx"
    sudo nginx -t
    exit 1
fi

# Actualizar DNS dinámico
log_info "Actualizando DNS dinámico..."
if [ -f "scripts/update-duckdns.sh" ]; then
    ./scripts/update-duckdns.sh
    log_success "DNS dinámico actualizado"
fi

# Detener servicios existentes si están corriendo
log_info "Deteniendo servicios existentes..."
sudo systemctl stop reparacion-pc 2>/dev/null || true

# Iniciar nginx
log_info "Iniciando nginx..."
if ! systemctl is-active --quiet nginx; then
    sudo systemctl start nginx
fi

if check_service nginx; then
    log_success "nginx iniciado correctamente"
else
    log_error "Error al iniciar nginx"
    exit 1
fi

# Iniciar aplicación Node.js
log_info "Iniciando aplicación Node.js..."
sudo systemctl start reparacion-pc

# Esperar a que el servicio inicie
sleep 3

if check_service reparacion-pc; then
    log_success "Servicio reparacion-pc iniciado correctamente"
else
    log_error "Error al iniciar el servicio"
    log_info "Revisando logs..."
    sudo journalctl -u reparacion-pc --lines=10 --no-pager
    exit 1
fi

# Verificar puertos
log_info "Verificando puertos..."
check_port 80
check_port 443
check_port 3000

# Health check de la aplicación
log_info "Ejecutando health check..."
if health_check; then
    log_success "Aplicación funcionando correctamente"
else
    log_error "La aplicación no responde correctamente"
    log_info "Revisando logs de la aplicación..."
    sudo journalctl -u reparacion-pc --lines=20 --no-pager
    exit 1
fi

# Mostrar información del sistema
log_info "=== INFORMACIÓN DEL SISTEMA ==="
echo "🌐 Dominio: $DOMAIN"
echo "🔒 SSL: $([ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && echo "Activo" || echo "No configurado")"
echo "📧 Email: $EMAIL_USER"
echo "📱 WhatsApp: $WHATSAPP_NUMBER"
echo "🖥️  Puerto interno: $PORT"
echo "📊 Estado: Funcionando"
echo

# Mostrar URLs de acceso
log_success "=== SISTEMA INICIADO CORRECTAMENTE ==="
echo
log_info "URLs de acceso:"
echo "  🌍 Sitio web: https://$DOMAIN"
echo "  🔧 Panel de salud: https://$DOMAIN/api/health"
echo "  📋 Logs: sudo journalctl -u reparacion-pc -f"
echo
log_info "Para detener el sistema: sudo systemctl stop reparacion-pc nginx"
log_info "Para ver el estado: sudo systemctl status reparacion-pc"
echo

# Crear archivo de estado
cat > .server-status << EOF
STARTED_AT=$(date)
PID_NGINX=$(pgrep nginx | head -1)
PID_NODE=$(pgrep -f "node backend/server.js")
DOMAIN=$DOMAIN
PORT=$PORT
SSL_STATUS=$([ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && echo "ACTIVE" || echo "NOT_CONFIGURED")
EOF

log_success "Sistema de Reparación PC iniciado exitosamente!"