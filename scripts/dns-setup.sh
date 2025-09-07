#!/bin/bash

# Script para configurar DNS dinámico con DuckDNS
# Incluye configuración automática, verificación y monitoreo

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

log_info "=== Configuración de DNS Dinámico (DuckDNS) ==="
echo

# Verificar archivo .env
if [ ! -f ".env" ]; then
    log_error "Archivo .env no encontrado"
    log_info "Configura el archivo .env antes de continuar"
    exit 1
fi

# Cargar variables de entorno
source .env

# 1. Configurar DuckDNS si no está configurado
if [ -z "$DUCKDNS_DOMAIN" ] || [ -z "$DUCKDNS_TOKEN" ]; then
    log_warning "Variables de DuckDNS no configuradas"
    echo
    log_info "Para configurar DuckDNS:"
    echo "1. Ve a https://www.duckdns.org/"
    echo "2. Inicia sesión con Google/GitHub/Twitter"
    echo "3. Crea un subdominio (ej: mi-servicio-pc)"
    echo "4. Copia el token que aparece en la página"
    echo
    
    read -p "¿Has completado estos pasos? (s/N): " setup_done
    if [[ ! "$setup_done" =~ ^[sS]$ ]]; then
        log_info "Completa la configuración en DuckDNS y vuelve a ejecutar este script"
        exit 1
    fi
    
    echo
    read -p "Ingresa tu subdominio de DuckDNS (sin .duckdns.org): " duckdns_domain
    read -p "Ingresa tu token de DuckDNS: " duckdns_token
    
    # Actualizar .env
    if grep -q "DUCKDNS_DOMAIN=" .env; then
        sed -i "s/DUCKDNS_DOMAIN=.*/DUCKDNS_DOMAIN=$duckdns_domain/" .env
    else
        echo "DUCKDNS_DOMAIN=$duckdns_domain" >> .env
    fi
    
    if grep -q "DUCKDNS_TOKEN=" .env; then
        sed -i "s/DUCKDNS_TOKEN=.*/DUCKDNS_TOKEN=$duckdns_token/" .env
    else
        echo "DUCKDNS_TOKEN=$duckdns_token" >> .env
    fi
    
    # Recargar variables
    source .env
    
    log_success "Configuración de DuckDNS actualizada en .env"
fi

log_info "Dominio DuckDNS: $DUCKDNS_DOMAIN.duckdns.org"

# 2. Obtener IP pública actual
log_info "2. Detectando IP pública..."
CURRENT_IP=""

# Intentar varios servicios para obtener la IP
IP_SERVICES=(
    "https://ipv4.icanhazip.com"
    "https://api.ipify.org"
    "https://checkip.amazonaws.com"
    "https://ifconfig.me"
)

for service in "${IP_SERVICES[@]}"; do
    if CURRENT_IP=$(curl -s --max-time 5 "$service" 2>/dev/null); then
        # Validar que es una IP válida
        if [[ $CURRENT_IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            log_success "IP pública detectada: $CURRENT_IP"
            break
        fi
    fi
done

if [ -z "$CURRENT_IP" ]; then
    log_error "No se pudo detectar la IP pública"
    log_info "Verifica tu conexión a internet"
    exit 1
fi

# 3. Actualizar DuckDNS
log_info "3. Actualizando DNS en DuckDNS..."
DUCKDNS_URL="https://www.duckdns.org/update?domains=$DUCKDNS_DOMAIN&token=$DUCKDNS_TOKEN&ip=$CURRENT_IP"

RESPONSE=$(curl -s "$DUCKDNS_URL")

if [ "$RESPONSE" = "OK" ]; then
    log_success "DNS actualizado correctamente en DuckDNS"
else
    log_error "Error al actualizar DNS: $RESPONSE"
    log_info "Verifica tu dominio y token de DuckDNS"
    exit 1
fi

# 4. Crear script de actualización automática
log_info "4. Configurando actualización automática..."

# Script mejorado de actualización
cat > scripts/update-duckdns.sh << 'EOF'
#!/bin/bash

# Script de actualización automática de DuckDNS
# Incluye logging y verificación de cambios

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$BASE_DIR/logs/duckdns.log"
IP_FILE="$BASE_DIR/.last_ip"

# Crear directorio de logs si no existe
mkdir -p "$(dirname "$LOG_FILE")"

# Función de logging
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Cargar variables de entorno
if [ -f "$BASE_DIR/.env" ]; then
    source "$BASE_DIR/.env"
else
    log_message "ERROR: Archivo .env no encontrado"
    exit 1
fi

# Verificar configuración
if [ -z "$DUCKDNS_DOMAIN" ] || [ -z "$DUCKDNS_TOKEN" ]; then
    log_message "ERROR: Variables DUCKDNS_DOMAIN o DUCKDNS_TOKEN no configuradas"
    exit 1
fi

# Obtener IP pública actual
IP_SERVICES=(
    "https://ipv4.icanhazip.com"
    "https://api.ipify.org"
    "https://checkip.amazonaws.com"
    "https://ifconfig.me"
)

CURRENT_IP=""
for service in "${IP_SERVICES[@]}"; do
    if CURRENT_IP=$(curl -s --max-time 5 "$service" 2>/dev/null); then
        if [[ $CURRENT_IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            break
        fi
    fi
done

if [ -z "$CURRENT_IP" ]; then
    log_message "ERROR: No se pudo obtener la IP pública"
    exit 1
fi

# Verificar si la IP cambió
LAST_IP=""
if [ -f "$IP_FILE" ]; then
    LAST_IP=$(cat "$IP_FILE")
fi

if [ "$CURRENT_IP" = "$LAST_IP" ]; then
    # IP no cambió, solo log cada hora
    CURRENT_HOUR=$(date +%H)
    if [ "$CURRENT_HOUR" = "00" ] || [ "$CURRENT_HOUR" = "12" ]; then
        log_message "INFO: IP sin cambios ($CURRENT_IP)"
    fi
    exit 0
fi

# IP cambió, actualizar DuckDNS
log_message "INFO: IP cambió de '$LAST_IP' a '$CURRENT_IP', actualizando DNS..."

DUCKDNS_URL="https://www.duckdns.org/update?domains=$DUCKDNS_DOMAIN&token=$DUCKDNS_TOKEN&ip=$CURRENT_IP"
RESPONSE=$(curl -s --max-time 10 "$DUCKDNS_URL")

if [ "$RESPONSE" = "OK" ]; then
    log_message "SUCCESS: DNS actualizado correctamente ($CURRENT_IP)"
    echo "$CURRENT_IP" > "$IP_FILE"
    
    # Opcional: Webhook de notificación (si está configurado)
    if [ ! -z "$WEBHOOK_URL" ]; then
        curl -s -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🌐 DNS actualizado: $DUCKDNS_DOMAIN.duckdns.org -> $CURRENT_IP\"}" \
            >/dev/null 2>&1
    fi
else
    log_message "ERROR: Fallo al actualizar DNS - Respuesta: $RESPONSE"
    exit 1
fi
EOF

chmod +x scripts/update-duckdns.sh

# 5. Configurar cron job para actualización automática
log_info "5. Configurando actualización automática (cron)..."

# Eliminar trabajos anteriores de DuckDNS
crontab -l 2>/dev/null | grep -v "update-duckdns" | crontab -

# Agregar nuevo trabajo cada 5 minutos
(crontab -l 2>/dev/null; echo "*/5 * * * * cd $(pwd) && ./scripts/update-duckdns.sh") | crontab -

log_success "Cron job configurado (actualización cada 5 minutos)"

# 6. Configurar logrotate para logs de DNS
log_info "6. Configurando rotación de logs..."

sudo tee /etc/logrotate.d/duckdns > /dev/null << EOF
$(pwd)/logs/duckdns.log {
    weekly
    missingok
    rotate 12
    compress
    notifempty
    create 644 $USER $USER
    su $USER $USER
}
EOF

# 7. Crear script de verificación DNS
log_info "7. Creando herramientas de verificación..."

cat > scripts/dns-check.sh << 'EOF'
#!/bin/bash

# Script para verificar el estado del DNS dinámico

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Cargar variables de entorno
if [ -f "$BASE_DIR/.env" ]; then
    source "$BASE_DIR/.env"
else
    echo "Error: Archivo .env no encontrado"
    exit 1
fi

if [ -z "$DUCKDNS_DOMAIN" ]; then
    echo "Error: Variable DUCKDNS_DOMAIN no configurada"
    exit 1
fi

FULL_DOMAIN="${DUCKDNS_DOMAIN}.duckdns.org"

echo "=== Verificación de DNS Dinámico ==="
echo "Dominio: $FULL_DOMAIN"
echo

# 1. Obtener IP pública actual
echo "🌐 Obteniendo IP pública actual..."
CURRENT_IP=$(curl -s https://api.ipify.org)
echo "IP pública: $CURRENT_IP"
echo

# 2. Resolver DNS del dominio
echo "🔍 Resolviendo DNS..."
RESOLVED_IP=$(dig +short "$FULL_DOMAIN" @8.8.8.8 | tail -n1)

if [ -z "$RESOLVED_IP" ]; then
    echo "❌ No se pudo resolver el dominio"
    exit 1
fi

echo "IP del dominio: $RESOLVED_IP"
echo

# 3. Comparar IPs
if [ "$CURRENT_IP" = "$RESOLVED_IP" ]; then
    echo "✅ DNS está sincronizado correctamente"
    STATUS="OK"
else
    echo "⚠️  DNS no está sincronizado:"
    echo "  IP pública: $CURRENT_IP"
    echo "  IP en DNS:  $RESOLVED_IP"
    STATUS="MISMATCH"
fi

echo

# 4. Verificar última actualización
if [ -f "$BASE_DIR/.last_ip" ]; then
    LAST_IP=$(cat "$BASE_DIR/.last_ip")
    echo "📝 Última IP guardada: $LAST_IP"
fi

if [ -f "$BASE_DIR/logs/duckdns.log" ]; then
    echo "📋 Última actualización:"
    tail -n 3 "$BASE_DIR/logs/duckdns.log"
fi

echo

# 5. Test de conectividad
echo "🔗 Verificando conectividad..."
if timeout 10 curl -sf "http://$FULL_DOMAIN" >/dev/null 2>&1; then
    echo "✅ Dominio accesible vía HTTP"
else
    echo "❌ Dominio no accesible vía HTTP"
fi

if timeout 10 curl -sf "https://$FULL_DOMAIN" >/dev/null 2>&1; then
    echo "✅ Dominio accesible vía HTTPS"
else
    echo "⚠️  Dominio no accesible vía HTTPS (puede ser normal si no hay SSL)"
fi

echo
echo "Estado general: $STATUS"
EOF

chmod +x scripts/dns-check.sh

# 8. Actualizar .env con el dominio completo si es necesario
if [ -z "$DOMAIN" ] || [ "$DOMAIN" != "${DUCKDNS_DOMAIN}.duckdns.org" ]; then
    log_info "8. Actualizando variable DOMAIN en .env..."
    
    if grep -q "DOMAIN=" .env; then
        sed -i "s/DOMAIN=.*/DOMAIN=${DUCKDNS_DOMAIN}.duckdns.org/" .env
    else
        echo "DOMAIN=${DUCKDNS_DOMAIN}.duckdns.org" >> .env
    fi
    
    # Actualizar BASE_URL también
    if grep -q "BASE_URL=" .env; then
        sed -i "s/BASE_URL=.*/BASE_URL=https:\/\/${DUCKDNS_DOMAIN}.duckdns.org/" .env
    else
        echo "BASE_URL=https://${DUCKDNS_DOMAIN}.duckdns.org" >> .env
    fi
    
    log_success "Variables DOMAIN y BASE_URL actualizadas"
fi

# 9. Verificación final
log_info "9. Verificando configuración..."

# Esperar un poco para que se propague el DNS
sleep 10

# Verificar resolución DNS
RESOLVED_IP=$(dig +short "${DUCKDNS_DOMAIN}.duckdns.org" @8.8.8.8 | tail -n1)

if [ "$RESOLVED_IP" = "$CURRENT_IP" ]; then
    log_success "DNS funcionando correctamente"
else
    log_warning "DNS puede tardar unos minutos en propagarse"
    log_info "IP actual: $CURRENT_IP"
    log_info "IP en DNS: $RESOLVED_IP"
fi

# 10. Información final
echo
log_success "=== CONFIGURACIÓN DNS COMPLETADA ==="
echo
echo "🌐 Dominio: ${DUCKDNS_DOMAIN}.duckdns.org"
echo "📍 IP actual: $CURRENT_IP"
echo "🔄 Actualización: Automática (cada 5 minutos)"
echo "📊 Logs: logs/duckdns.log"
echo
log_info "URLs de acceso:"
echo "  • HTTP: http://${DUCKDNS_DOMAIN}.duckdns.org"
echo "  • HTTPS: https://${DUCKDNS_DOMAIN}.duckdns.org (después de configurar SSL)"
echo
log_info "Comandos útiles:"
echo "  • Verificar DNS: ./scripts/dns-check.sh"
echo "  • Actualizar manualmente: ./scripts/update-duckdns.sh"
echo "  • Ver logs: tail -f logs/duckdns.log"
echo "  • Ver cron jobs: crontab -l"
echo
log_warning "PRÓXIMOS PASOS:"
echo "• Configura SSL con: ./scripts/ssl-setup.sh"
echo "• El DNS puede tardar 5-10 minutos en propagarse completamente"
echo "• Asegúrate de configurar port forwarding en tu router"
echo

# Crear archivo de estado DNS
cat > .dns-status << EOF
DNS_CONFIGURED=true
DUCKDNS_DOMAIN=$DUCKDNS_DOMAIN
FULL_DOMAIN=${DUCKDNS_DOMAIN}.duckdns.org
CURRENT_IP=$CURRENT_IP
CONFIGURED_DATE=$(date)
AUTO_UPDATE=enabled
CRON_JOB=*/5 * * * *
EOF

log_success "Configuración DNS completada exitosamente!"