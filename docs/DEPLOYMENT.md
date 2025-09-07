# 🚀 Guía Completa de Deployment

## 📋 Índice
1. [Pre-Deployment](#pre-deployment)
2. [Proceso de Deployment](#proceso-de-deployment)
3. [Verificaciones Post-Deployment](#verificaciones-post-deployment)
4. [Configuración de Monitoreo](#configuración-de-monitoreo)
5. [Backup y Recuperación](#backup-y-recuperación)
6. [Actualizaciones del Sistema](#actualizaciones-del-sistema)
7. [Rollback y Contingencia](#rollback-y-contingencia)

---

## 🔍 Pre-Deployment

### ✅ Lista de Verificación Pre-Deploy

```bash
# 1. Verificar sistema
uname -a
df -h
free -h
systemctl status

# 2. Verificar dependencias
node --version
npm --version
nginx -v
certbot --version
sqlite3 --version

# 3. Verificar conectividad
ping google.com
curl -I https://api.ipify.org

# 4. Verificar puertos disponibles
netstat -tulpn | grep :80
netstat -tulpn | grep :443
netstat -tulpn | grep :3000
```

### 📄 Documentación Requerida

Antes del deployment, asegúrate de tener:

- [ ] Archivo `.env` completamente configurado
- [ ] Certificados o configuración SSL lista
- [ ] Información del router y port forwarding
- [ ] Credenciales de email y reCAPTCHA
- [ ] Plan de rollback en caso de fallo

### 🌐 Requisitos de Red

```bash
# Verificar IP pública
CURRENT_IP=$(curl -s https://api.ipify.org)
echo "IP Pública: $CURRENT_IP"

# Verificar DNS (si ya está configurado)
nslookup tu-dominio.com
dig tu-dominio.com

# Test de conectividad desde externa
# (usar desde otra red o móvil)
curl -I http://$CURRENT_IP
```

---

## 🚀 Proceso de Deployment

### 🏗️ Deployment Automático Completo

```bash
# Ejecutar deployment completo
./scripts/deploy.sh
```

### 📋 Deployment Manual Paso a Paso

#### 1. Preparación del Entorno

```bash
# Crear estructura de directorios
mkdir -p logs backups database

# Configurar permisos
chmod +x scripts/*.sh
chmod 644 .env
chmod 644 database/contacts.db
```

#### 2. Instalación de Dependencias

```bash
# Instalar dependencias del sistema
./scripts/install.sh

# Verificar instalación
node --version
npm list --depth=0
```

#### 3. Configuración de Base de Datos

```bash
# Inicializar base de datos
sqlite3 database/contacts.db < database/schema.sql

# Verificar estructura
sqlite3 database/contacts.db ".schema"
```

#### 4. Configuración de Servicios

```bash
# Configurar nginx
sudo cp config/nginx.conf /etc/nginx/sites-available/reparacion-pc
sudo ln -sf /etc/nginx/sites-available/reparacion-pc /etc/nginx/sites-enabled/
sudo nginx -t

# Configurar servicio systemd
sudo cp config/reparacion-pc.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable reparacion-pc
```

#### 5. Configuración DNS

```bash
# Para DuckDNS
./scripts/dns-setup.sh

# Verificar DNS
./scripts/dns-check.sh
```

#### 6. Configuración SSL

```bash
# Configurar certificados
./scripts/ssl-setup.sh

# Verificar SSL
./scripts/ssl-check.sh
```

#### 7. Inicio de Servicios

```bash
# Iniciar todos los servicios
./scripts/start.sh

# Verificar estado
systemctl status reparacion-pc
systemctl status nginx
```

---

## ✅ Verificaciones Post-Deployment

### 🔍 Health Checks Automáticos

```bash
#!/bin/bash
# Script: scripts/post-deploy-check.sh

echo "=== VERIFICACIONES POST-DEPLOYMENT ==="
echo

# 1. Verificar servicios
echo "1. Verificando servicios..."
systemctl is-active --quiet reparacion-pc && echo "✅ Aplicación: RUNNING" || echo "❌ Aplicación: STOPPED"
systemctl is-active --quiet nginx && echo "✅ Nginx: RUNNING" || echo "❌ Nginx: STOPPED"

# 2. Verificar puertos
echo "2. Verificando puertos..."
netstat -tuln | grep ":80 " && echo "✅ Puerto 80: OPEN" || echo "❌ Puerto 80: CLOSED"
netstat -tuln | grep ":443 " && echo "✅ Puerto 443: OPEN" || echo "❌ Puerto 443: CLOSED"
netstat -tuln | grep ":3000 " && echo "✅ Puerto 3000: OPEN" || echo "❌ Puerto 3000: CLOSED"

# 3. Health check HTTP
echo "3. Verificando health check..."
if curl -sf http://localhost:3000/api/health > /dev/null; then
    echo "✅ Health check: OK"
else
    echo "❌ Health check: FAILED"
fi

# 4. Verificar SSL
echo "4. Verificando SSL..."
source .env
if [ ! -z "$DOMAIN" ]; then
    if curl -sf https://$DOMAIN/api/health > /dev/null; then
        echo "✅ HTTPS: OK"
    else
        echo "❌ HTTPS: FAILED"
    fi
fi

# 5. Verificar DNS
echo "5. Verificando DNS..."
if [ ! -z "$DOMAIN" ]; then
    RESOLVED_IP=$(dig +short $DOMAIN @8.8.8.8 | tail -n1)
    CURRENT_IP=$(curl -s https://api.ipify.org)
    if [ "$RESOLVED_IP" = "$CURRENT_IP" ]; then
        echo "✅ DNS: SYNCHRONIZED"
    else
        echo "⚠️  DNS: NOT_SYNCHRONIZED (IP: $CURRENT_IP, DNS: $RESOLVED_IP)"
    fi
fi

echo
echo "=== DEPLOYMENT VERIFICATION COMPLETED ==="
```

### 📊 Verificación de Performance

```bash
# Test de carga básico
ab -n 100 -c 10 http://localhost:3000/

# Verificar memoria y CPU
free -h
top -p $(pgrep -f "node backend/server.js")

# Verificar logs de errores
tail -50 logs/app.log | grep -i error
```

### 🧪 Test de Funcionalidad

```bash
# Test de endpoints críticos
curl -I http://localhost:3000/
curl -I http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","message":"test"}'
```

---

## 📊 Configuración de Monitoreo

### 🔄 Monitoreo Automático

```bash
# Crear script de monitoreo
cat > scripts/monitor.sh << 'EOF'
#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$BASE_DIR/logs/monitor.log"

# Función de logging
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Verificar servicios
check_services() {
    if ! systemctl is-active --quiet reparacion-pc; then
        log_message "ERROR: Servicio reparacion-pc no está corriendo"
        systemctl start reparacion-pc
        log_message "INFO: Intentando reiniciar servicio"
    fi
    
    if ! systemctl is-active --quiet nginx; then
        log_message "ERROR: Nginx no está corriendo"
        systemctl start nginx
        log_message "INFO: Intentando reiniciar nginx"
    fi
}

# Verificar health endpoint
check_health() {
    if ! curl -sf http://localhost:3000/api/health > /dev/null; then
        log_message "ERROR: Health check falló"
        return 1
    fi
    return 0
}

# Verificar recursos del sistema
check_resources() {
    # Verificar espacio en disco
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt 90 ]; then
        log_message "WARNING: Uso de disco alto: $DISK_USAGE%"
    fi
    
    # Verificar memoria
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    if [ $MEM_USAGE -gt 90 ]; then
        log_message "WARNING: Uso de memoria alto: $MEM_USAGE%"
    fi
}

# Ejecutar verificaciones
check_services
check_health
check_resources

log_message "INFO: Monitoreo completado"
EOF

chmod +x scripts/monitor.sh

# Configurar cron para monitoreo cada 5 minutos
(crontab -l 2>/dev/null; echo "*/5 * * * * cd $(pwd) && ./scripts/monitor.sh") | crontab -
```

### 📈 Dashboard de Estado

```bash
# Crear script de dashboard
cat > scripts/dashboard.sh << 'EOF'
#!/bin/bash

clear
echo "════════════════════════════════════════════════"
echo "    🔧 DASHBOARD - SERVICIO REPARACIÓN PC"
echo "════════════════════════════════════════════════"
echo

# Información del sistema
echo "📊 SISTEMA:"
echo "   Fecha: $(date)"
echo "   Uptime: $(uptime -p)"
echo "   IP Pública: $(curl -s https://api.ipify.org)"
echo

# Estado de servicios
echo "⚙️  SERVICIOS:"
systemctl is-active --quiet reparacion-pc && echo "   ✅ Aplicación: RUNNING" || echo "   ❌ Aplicación: STOPPED"
systemctl is-active --quiet nginx && echo "   ✅ Nginx: RUNNING" || echo "   ❌ Nginx: STOPPED"
echo

# Recursos del sistema
echo "💻 RECURSOS:"
echo "   CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)% usado"
echo "   RAM: $(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')% usado"
echo "   Disco: $(df / | tail -1 | awk '{print $5}') usado"
echo

# Estadísticas de la aplicación
if [ -f ".env" ]; then
    source .env
    echo "🌐 CONFIGURACIÓN:"
    echo "   Dominio: $DOMAIN"
    echo "   Puerto: $PORT"
    echo "   Email: $EMAIL_USER"
    echo
fi

# Estadísticas de base de datos
if [ -f "database/contacts.db" ]; then
    TOTAL_CONTACTS=$(sqlite3 database/contacts.db "SELECT COUNT(*) FROM contacts;" 2>/dev/null || echo "0")
    BLOCKED_IPS=$(sqlite3 database/contacts.db "SELECT COUNT(*) FROM blocked_ips;" 2>/dev/null || echo "0")
    echo "📊 BASE DE DATOS:"
    echo "   Contactos: $TOTAL_CONTACTS"
    echo "   IPs bloqueadas: $BLOCKED_IPS"
    echo
fi

# Últimos logs
echo "📋 ÚLTIMOS EVENTOS:"
if [ -f "logs/app.log" ]; then
    tail -3 logs/app.log | while read line; do
        echo "   $line"
    done
fi

echo
echo "════════════════════════════════════════════════"
EOF

chmod +x scripts/dashboard.sh
```

---

## 💾 Backup y Recuperación

### 🔄 Backup Automático Diario

```bash
# Configurar backup automático diario a las 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * cd $(pwd) && ./scripts/backup.sh --silent") | crontab -

# Verificar configuración de cron
crontab -l
```

### 🔙 Procedimiento de Rollback

```bash
#!/bin/bash
# Script: scripts/rollback.sh

echo "=== PROCEDIMIENTO DE ROLLBACK ==="
echo

# 1. Parar servicios
echo "1. Deteniendo servicios..."
sudo systemctl stop reparacion-pc
sudo systemctl stop nginx

# 2. Crear backup del estado actual
echo "2. Creando backup del estado actual..."
./scripts/backup.sh

# 3. Restaurar desde backup anterior
echo "3. Listando backups disponibles:"
ls -la backups/backup_*.tar.gz | tail -5

echo
read -p "Ingresa el nombre del backup a restaurar: " backup_file

if [ -f "backups/$backup_file" ]; then
    echo "4. Restaurando backup: $backup_file"
    
    # Extraer backup
    cd backups
    tar -xzf "$backup_file"
    BACKUP_DIR=$(basename "$backup_file" .tar.gz)
    
    # Restaurar base de datos
    if [ -f "$BACKUP_DIR/contacts.db" ]; then
        cp "$BACKUP_DIR/contacts.db" ../database/
        echo "   ✅ Base de datos restaurada"
    fi
    
    # Restaurar configuración
    if [ -f "$BACKUP_DIR/config/.env" ]; then
        cp "$BACKUP_DIR/config/.env" ../
        echo "   ✅ Configuración restaurada"
    fi
    
    # Restaurar código
    if [ -d "$BACKUP_DIR/static" ]; then
        cp -r "$BACKUP_DIR/static"/* ../
        echo "   ✅ Código restaurado"
    fi
    
    cd ..
    
    # 5. Reiniciar servicios
    echo "5. Reiniciando servicios..."
    sudo systemctl start nginx
    sudo systemctl start reparacion-pc
    
    # 6. Verificar
    sleep 5
    ./scripts/post-deploy-check.sh
    
    echo "✅ Rollback completado"
else
    echo "❌ Backup no encontrado: $backup_file"
    exit 1
fi
```

---

## 🔄 Actualizaciones del Sistema

### 📦 Actualización de la Aplicación

```bash
#!/bin/bash
# Script: scripts/update.sh

echo "=== ACTUALIZACIÓN DE LA APLICACIÓN ==="
echo

# 1. Backup previo
echo "1. Creando backup previo..."
./scripts/backup.sh --silent

# 2. Parar aplicación (mantener nginx)
echo "2. Deteniendo aplicación..."
sudo systemctl stop reparacion-pc

# 3. Actualizar dependencias
echo "3. Actualizando dependencias..."
npm install
npm audit fix

# 4. Verificar configuración
echo "4. Verificando configuración..."
if [ -f ".env.example" ]; then
    echo "   Nuevas variables disponibles en .env.example"
    echo "   Revisa si necesitas añadir alguna a tu .env"
fi

# 5. Actualizar base de datos (si hay migraciones)
echo "5. Verificando base de datos..."
# Aquí irían las migraciones de DB si existieran

# 6. Reiniciar aplicación
echo "6. Reiniciando aplicación..."
sudo systemctl start reparacion-pc

# 7. Verificar funcionamiento
echo "7. Verificando funcionamiento..."
sleep 5
./scripts/post-deploy-check.sh

echo "✅ Actualización completada"
```

### 🔐 Actualización de Certificados SSL

```bash
# Renovar certificados manualmente
sudo certbot renew

# Verificar renovación automática
sudo systemctl status certbot.timer

# Re-configurar SSL si hay problemas
./scripts/ssl-setup.sh
```

### 🌐 Actualización de Sistema Operativo

```bash
#!/bin/bash
# Script: scripts/system-update.sh

echo "=== ACTUALIZACIÓN DEL SISTEMA ==="
echo

# 1. Backup completo
./scripts/backup.sh

# 2. Actualizar paquetes
sudo apt update
sudo apt list --upgradable

read -p "¿Continuar con la actualización? (s/N): " confirm
if [[ ! "$confirm" =~ ^[sS]$ ]]; then
    exit 0
fi

# 3. Actualizar sistema
sudo apt upgrade -y

# 4. Limpiar paquetes no necesarios
sudo apt autoremove -y
sudo apt autoclean

# 5. Verificar servicios después de actualización
./scripts/post-deploy-check.sh

echo "✅ Actualización del sistema completada"
```

---

## 🔧 Troubleshooting de Deployment

### 🚫 Problemas Comunes

#### Error: Puerto en uso
```bash
# Encontrar proceso que usa el puerto
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Terminar proceso específico
sudo kill -9 [PID]

# O detener servicio
sudo systemctl stop apache2
```

#### Error: Permisos insuficientes
```bash
# Corregir permisos de archivos
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
chmod 644 .env

# Permisos para nginx
sudo chown -R www-data:www-data /var/www/html
```

#### Error: Base de datos corrupta
```bash
# Verificar integridad
sqlite3 database/contacts.db "PRAGMA integrity_check;"

# Restaurar desde backup
cp backups/[ultimo-backup]/contacts.db database/
```

#### Error: SSL no funciona
```bash
# Verificar certificados
sudo certbot certificates

# Re-generar certificados
sudo certbot delete --cert-name tu-dominio.com
./scripts/ssl-setup.sh
```

### 📊 Logs de Deployment

```bash
# Crear log centralizado de deployment
exec > >(tee -a logs/deployment.log)
exec 2>&1

echo "$(date): Iniciando deployment..."
# ... resto del script de deployment ...
echo "$(date): Deployment completado"
```

---

## ✅ Checklist Final de Deployment

### Pre-Deployment
- [ ] Sistema actualizado y limpio
- [ ] Dependencias verificadas
- [ ] Archivo .env configurado
- [ ] Backup del estado actual
- [ ] Plan de rollback preparado

### Durante Deployment
- [ ] Servicios detenidos correctamente
- [ ] Base de datos migrada/actualizada
- [ ] Archivos copiados correctamente
- [ ] Permisos configurados
- [ ] Servicios reiniciados

### Post-Deployment
- [ ] Health checks pasando
- [ ] SSL funcionando
- [ ] DNS resolviendo correctamente
- [ ] Formulario de contacto funcionando
- [ ] Emails enviándose
- [ ] Logs sin errores críticos
- [ ] Performance aceptable
- [ ] Backup post-deployment realizado

### Configuración de Monitoreo
- [ ] Cron jobs configurados
- [ ] Scripts de monitoreo funcionando
- [ ] Alertas configuradas
- [ ] Dashboard accesible

---

## 🎉 ¡Deployment Exitoso!

Con todos estos pasos completados, tu servicio de reparación PC está:

- ✅ **Desplegado** correctamente
- ✅ **Monitoreado** automáticamente  
- ✅ **Respaldado** con backups regulares
- ✅ **Preparado** para actualizaciones
- ✅ **Protegido** con SSL y seguridad
- ✅ **Accesible** desde internet

**URLs importantes:**
- 🌍 Sitio web: https://tu-dominio.com
- 🔧 Health check: https://tu-dominio.com/api/health
- 📊 Dashboard: `./scripts/dashboard.sh`