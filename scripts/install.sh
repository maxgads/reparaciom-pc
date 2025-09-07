#!/bin/bash

# Script de instalación completa para el proyecto de reparación PC
# Compatible con Ubuntu/Debian y derivados

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función para mostrar mensajes
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Verificar si el script se ejecuta como root
if [[ $EUID -eq 0 ]]; then
   log_error "Este script no debe ejecutarse como root"
   exit 1
fi

log_info "=== Instalación del Sistema de Reparación PC ==="
log_info "Este script instalará todas las dependencias necesarias"
echo

# Verificar sistema operativo
if ! command -v apt-get &> /dev/null; then
    log_error "Este script solo funciona en sistemas basados en Debian/Ubuntu"
    exit 1
fi

# Actualizar sistema
log_info "Actualizando el sistema..."
sudo apt-get update && sudo apt-get upgrade -y

# Instalar Node.js y npm
log_info "Instalando Node.js y npm..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    log_success "Node.js ya está instalado ($(node --version))"
fi

# Instalar nginx
log_info "Instalando nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
else
    log_success "nginx ya está instalado"
fi

# Instalar certbot para SSL
log_info "Instalando certbot para SSL..."
if ! command -v certbot &> /dev/null; then
    sudo apt-get install -y certbot python3-certbot-nginx
else
    log_success "certbot ya está instalado"
fi

# Instalar sqlite3
log_info "Instalando sqlite3..."
if ! command -v sqlite3 &> /dev/null; then
    sudo apt-get install -y sqlite3
else
    log_success "sqlite3 ya está instalado"
fi

# Instalar dependencias adicionales
log_info "Instalando dependencias adicionales..."
sudo apt-get install -y curl wget unzip git ufw fail2ban

# Crear package.json si no existe
if [ ! -f "package.json" ]; then
    log_info "Creando package.json..."
    cat > package.json << 'EOF'
{
  "name": "servicio-reparacion-pc",
  "version": "1.0.0",
  "description": "Sitio web profesional para servicio de reparación de PC",
  "main": "backend/server.js",
  "scripts": {
    "start": "node backend/server.js",
    "dev": "nodemon backend/server.js",
    "install-deps": "npm install",
    "setup-db": "node scripts/setup-database.js",
    "backup": "./scripts/backup.sh",
    "ssl-renew": "sudo certbot renew --nginx",
    "health-check": "curl -f http://localhost:3000/api/health || exit 1"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "sqlite3": "^5.1.6",
    "nodemailer": "^6.9.7",
    "express-validator": "^7.0.1",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "compression": "^1.7.4",
    "express-session": "^1.17.3",
    "connect-sqlite3": "^0.9.13",
    "axios": "^1.6.2",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  },
  "keywords": ["reparacion", "pc", "servicio", "local", "argentina"],
  "author": "Servicio Reparación PC",
  "license": "MIT"
}
EOF
fi

# Instalar dependencias de Node.js
log_info "Instalando dependencias de Node.js..."
npm install

# Crear estructura de base de datos
log_info "Configurando base de datos..."
mkdir -p database
sqlite3 database/contacts.db << 'EOF'
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    equipment_type TEXT NOT NULL,
    problem_description TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'new'
);

CREATE TABLE IF NOT EXISTS blocked_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT UNIQUE NOT NULL,
    reason TEXT,
    blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    requests_count INTEGER DEFAULT 1,
    window_start DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip_address);
EOF

# Configurar permisos de base de datos
chmod 644 database/contacts.db
chown $USER:$USER database/contacts.db

# Crear archivo .env.example si no existe
if [ ! -f ".env.example" ]; then
    log_info "Creando archivo .env.example..."
    cat > .env.example << 'EOF'
# Configuración del servidor
PORT=3000
NODE_ENV=production
DOMAIN=tu-dominio.com.ar
BASE_URL=https://tu-dominio.com.ar

# Base de datos
DB_PATH=./database/contacts.db

# Configuración de email (Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password
EMAIL_TO=tu-email@gmail.com

# reCAPTCHA v3
RECAPTCHA_SITE_KEY=tu-site-key-aqui
RECAPTCHA_SECRET_KEY=tu-secret-key-aqui

# Seguridad
JWT_SECRET=tu-jwt-secret-muy-seguro-aqui-minimo-32-caracteres
SESSION_SECRET=tu-session-secret-aqui

# Rate limiting
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=3

# WhatsApp Business
WHATSAPP_NUMBER=5491112345678

# DuckDNS (DNS dinámico)
DUCKDNS_DOMAIN=tu-subdominio
DUCKDNS_TOKEN=tu-token-duckdns

# Configuración SSL
SSL_EMAIL=tu-email@gmail.com
EOF
fi

# Configurar nginx
log_info "Configurando nginx..."
sudo cp config/nginx.conf /etc/nginx/sites-available/reparacion-pc
sudo ln -sf /etc/nginx/sites-available/reparacion-pc /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Configurar firewall básico
log_info "Configurando firewall..."
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Configurar fail2ban
log_info "Configurando fail2ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Crear servicio systemd
log_info "Creando servicio systemd..."
sudo tee /etc/systemd/system/reparacion-pc.service > /dev/null << EOF
[Unit]
Description=Servicio Reparación PC
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PWD
Environment=NODE_ENV=production
ExecStart=/usr/bin/node backend/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable reparacion-pc

# Crear script de actualización DuckDNS
log_info "Creando script de actualización DuckDNS..."
cat > scripts/update-duckdns.sh << 'EOF'
#!/bin/bash
source .env
echo url="https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=" | curl -k -o /tmp/duck.log -K -
EOF

chmod +x scripts/update-duckdns.sh

# Configurar cron para DuckDNS
log_info "Configurando actualización automática de DNS..."
(crontab -l 2>/dev/null; echo "*/5 * * * * cd $PWD && ./scripts/update-duckdns.sh") | crontab -

# Crear log de instalación
log_success "=== INSTALACIÓN COMPLETADA ==="
echo
log_info "Próximos pasos:"
echo "1. Copia .env.example a .env y configura las variables"
echo "2. Configura tu router para port forwarding (puerto 80 y 443)"
echo "3. Ejecuta './scripts/ssl-setup.sh' para configurar SSL"
echo "4. Ejecuta './scripts/start.sh' para iniciar el servidor"
echo
log_warning "IMPORTANTE:"
echo "- Configura las variables en el archivo .env antes de continuar"
echo "- Asegúrate de que el dominio apunte a tu IP pública"
echo "- El router debe tener port forwarding configurado"
echo
log_info "Para obtener ayuda, consulta docs/SETUP.md"