#!/bin/bash

# Script de configuración SSL automática con Let's Encrypt
# Incluye configuración de certificados, renovación automática y verificación

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

# Verificar si se ejecuta como root para ciertas operaciones
check_sudo() {
    if ! sudo -n true 2>/dev/null; then
        log_error "Este script requiere permisos sudo"
        exit 1
    fi
}

log_info "=== Configuración SSL Automática ==="
log_info "Let's Encrypt + nginx + renovación automática"
echo

# Verificar archivo .env
if [ ! -f ".env" ]; then
    log_error "Archivo .env no encontrado"
    log_info "Configura el archivo .env antes de continuar"
    exit 1
fi

# Cargar variables de entorno
source .env

# Verificar variables críticas
if [ -z "$DOMAIN" ]; then
    log_error "Variable DOMAIN no configurada en .env"
    exit 1
fi

if [ -z "$SSL_EMAIL" ]; then
    log_error "Variable SSL_EMAIL no configurada en .env"
    exit 1
fi

log_info "Dominio: $DOMAIN"
log_info "Email: $SSL_EMAIL"

# Verificar sudo
check_sudo

# 1. Verificar que certbot está instalado
log_info "1. Verificando certbot..."
if ! command -v certbot &> /dev/null; then
    log_warning "certbot no encontrado, instalando..."
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi
log_success "certbot está disponible"

# 2. Verificar que nginx está instalado y corriendo
log_info "2. Verificando nginx..."
if ! command -v nginx &> /dev/null; then
    log_error "nginx no está instalado. Ejecuta primero ./scripts/install.sh"
    exit 1
fi

if ! systemctl is-active --quiet nginx; then
    log_info "Iniciando nginx..."
    sudo systemctl start nginx
fi
log_success "nginx está corriendo"

# 3. Verificar configuración de nginx
log_info "3. Configurando nginx para SSL..."

# Crear configuración temporal para validación
TEMP_NGINX_CONF="/etc/nginx/sites-available/reparacion-pc-temp"
sudo tee "$TEMP_NGINX_CONF" > /dev/null << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Directorio para Let's Encrypt challenge
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        try_files \$uri =404;
    }
    
    # Redirección temporal a backend para otras rutas
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Activar configuración temporal
sudo rm -f /etc/nginx/sites-enabled/reparacion-pc
sudo ln -sf "$TEMP_NGINX_CONF" /etc/nginx/sites-enabled/reparacion-pc-temp

# Verificar configuración de nginx
if sudo nginx -t; then
    sudo systemctl reload nginx
    log_success "Configuración temporal de nginx aplicada"
else
    log_error "Error en configuración de nginx"
    exit 1
fi

# 4. Crear directorio para challenges
log_info "4. Preparando directorio web..."
sudo mkdir -p /var/www/html/.well-known/acme-challenge
sudo chown -R www-data:www-data /var/www/html

# 5. Verificar conectividad del dominio
log_info "5. Verificando conectividad del dominio..."
if curl -s --max-time 10 "http://$DOMAIN/.well-known/acme-challenge/" > /dev/null 2>&1; then
    log_success "Dominio es accesible desde internet"
else
    log_warning "No se puede verificar conectividad del dominio"
    log_warning "Asegúrate de que:"
    echo "  - El dominio $DOMAIN apunta a tu IP pública"
    echo "  - El router tiene port forwarding configurado (puerto 80)"
    echo "  - No hay firewalls bloqueando el puerto 80"
    echo
    read -p "¿Continuar de todos modos? (s/N): " continue_anyway
    if [[ ! "$continue_anyway" =~ ^[sS]$ ]]; then
        exit 1
    fi
fi

# 6. Obtener certificado SSL
log_info "6. Obteniendo certificado SSL de Let's Encrypt..."

# Parámetros para certbot
CERTBOT_PARAMS="--nginx --agree-tos --no-eff-email --email $SSL_EMAIL"

# Obtener certificado para dominio principal y www
if sudo certbot $CERTBOT_PARAMS -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive; then
    log_success "Certificado SSL obtenido exitosamente"
else
    log_warning "Error al obtener certificado con www, intentando solo dominio principal..."
    if sudo certbot $CERTBOT_PARAMS -d "$DOMAIN" --non-interactive; then
        log_success "Certificado SSL obtenido para dominio principal"
    else
        log_error "Error al obtener certificado SSL"
        log_info "Verifica:"
        echo "  - Que el dominio apunte correctamente a tu IP"
        echo "  - Que el puerto 80 esté accesible desde internet"
        echo "  - Que no haya rate limits de Let's Encrypt"
        exit 1
    fi
fi

# 7. Instalar configuración final de nginx
log_info "7. Configurando nginx con SSL..."

# Eliminar configuración temporal
sudo rm -f /etc/nginx/sites-enabled/reparacion-pc-temp

# Copiar y configurar nginx.conf final
sudo cp config/nginx.conf /etc/nginx/sites-available/reparacion-pc

# Reemplazar placeholder del dominio
sudo sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/reparacion-pc

# Activar configuración final
sudo ln -sf /etc/nginx/sites-available/reparacion-pc /etc/nginx/sites-enabled/

# Verificar configuración final
if sudo nginx -t; then
    sudo systemctl reload nginx
    log_success "Configuración SSL de nginx aplicada"
else
    log_error "Error en configuración final de nginx"
    sudo nginx -t
    exit 1
fi

# 8. Configurar renovación automática
log_info "8. Configurando renovación automática..."

# Crear script de renovación
sudo tee /etc/cron.d/certbot-renewal > /dev/null << EOF
# Renovación automática de certificados Let's Encrypt
# Se ejecuta dos veces al día para verificar y renovar si es necesario

0 12 * * * root certbot renew --quiet --post-hook "systemctl reload nginx"
0 0 * * * root certbot renew --quiet --post-hook "systemctl reload nginx"
EOF

# Configurar logrotate para logs de SSL
sudo tee /etc/logrotate.d/ssl-renewal > /dev/null << EOF
/var/log/letsencrypt/*.log {
    monthly
    missingok
    rotate 12
    compress
    notifempty
    create 644 root root
}
EOF

log_success "Renovación automática configurada"

# 9. Crear script de verificación SSL
log_info "9. Creando herramientas de verificación..."

cat > scripts/ssl-check.sh << 'EOF'
#!/bin/bash

# Script para verificar el estado de certificados SSL

DOMAIN=$(grep "^DOMAIN=" .env | cut -d'=' -f2)

if [ -z "$DOMAIN" ]; then
    echo "Error: Dominio no configurado en .env"
    exit 1
fi

echo "=== Verificación de Certificados SSL ==="
echo "Dominio: $DOMAIN"
echo

# Verificar certificado local
if [ -f "/etc/letsencrypt/live/$DOMAIN/cert.pem" ]; then
    echo "📋 Información del certificado:"
    openssl x509 -in "/etc/letsencrypt/live/$DOMAIN/cert.pem" -noout -dates -subject
    echo
    
    # Verificar expiración
    if openssl x509 -checkend 2592000 -noout -in "/etc/letsencrypt/live/$DOMAIN/cert.pem"; then
        echo "✅ Certificado válido por más de 30 días"
    else
        echo "⚠️  Certificado expira en menos de 30 días"
    fi
    echo
    
    # Verificar conectividad SSL
    echo "🌐 Verificando conectividad SSL..."
    if echo | timeout 10 openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | grep -q "Verify return code: 0"; then
        echo "✅ Certificado SSL funcionando correctamente"
    else
        echo "❌ Error en certificado SSL o conectividad"
    fi
else
    echo "❌ Certificado no encontrado"
fi
EOF

chmod +x scripts/ssl-check.sh

log_success "Script de verificación creado en scripts/ssl-check.sh"

# 10. Verificar instalación completa
log_info "10. Verificando instalación SSL..."

# Esperar a que nginx se recargue completamente
sleep 3

# Verificar que el certificado está funcionando
if timeout 10 curl -sf "https://$DOMAIN/api/health" > /dev/null 2>&1; then
    log_success "SSL funcionando correctamente"
else
    log_warning "SSL configurado pero hay problemas de conectividad"
fi

# Test de renovación
log_info "Probando renovación de certificados..."
if sudo certbot renew --dry-run > /dev/null 2>&1; then
    log_success "Test de renovación exitoso"
else
    log_warning "Problema con test de renovación"
fi

# 11. Información final
echo
log_success "=== CONFIGURACIÓN SSL COMPLETADA ==="
echo
echo "🔒 Certificado SSL: Activo"
echo "🌍 Dominio: https://$DOMAIN"
echo "📧 Email: $SSL_EMAIL"
echo "🔄 Renovación: Automática (2 veces al día)"
echo
log_info "URLs de verificación:"
echo "  • Sitio web: https://$DOMAIN"
echo "  • Health check: https://$DOMAIN/api/health"
echo "  • Test SSL: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo
log_info "Comandos útiles:"
echo "  • Verificar certificado: ./scripts/ssl-check.sh"
echo "  • Renovar manualmente: sudo certbot renew"
echo "  • Estado de nginx: sudo systemctl status nginx"
echo
log_warning "IMPORTANTE:"
echo "• Asegúrate de que el puerto 443 esté abierto en tu firewall"
echo "• Configura port forwarding en tu router para el puerto 443"
echo "• Los certificados se renuevan automáticamente cada 60 días"
echo

# Crear archivo de estado SSL
cat > .ssl-status << EOF
SSL_CONFIGURED=true
DOMAIN=$DOMAIN
SSL_EMAIL=$SSL_EMAIL
CONFIGURED_DATE=$(date)
CERT_PATH=/etc/letsencrypt/live/$DOMAIN
AUTO_RENEWAL=enabled
EOF

log_success "Configuración SSL completada exitosamente!"