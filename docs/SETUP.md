# 🔧 Guía Completa de Instalación y Configuración

## 📋 Índice
1. [Requisitos del Sistema](#requisitos-del-sistema)
2. [Instalación Automática](#instalación-automática)
3. [Configuración Inicial](#configuración-inicial)
4. [Configuración de Router](#configuración-de-router)
5. [Configuración DNS](#configuración-dns)
6. [Configuración SSL](#configuración-ssl)
7. [Verificación y Pruebas](#verificación-y-pruebas)
8. [Resolución de Problemas](#resolución-de-problemas)

---

## 📊 Requisitos del Sistema

### 🐧 Linux (Ubuntu/Debian)
- **OS**: Ubuntu 18.04+ o Debian 9+
- **RAM**: Mínimo 512MB, recomendado 1GB
- **Disco**: 2GB libres
- **CPU**: 1 core
- **Red**: Conexión a internet estable
- **Permisos**: Usuario con sudo

### 🪟 Windows
- **OS**: Windows 10/11 (64-bit)
- **RAM**: Mínimo 1GB, recomendado 2GB
- **Disco**: 2GB libres
- **Permisos**: Administrador
- **Red**: Conexión a internet estable

### 🌐 Red y Conectividad
- **IP Pública**: Requerida
- **Router**: Con soporte para port forwarding
- **Puertos**: 80 y 443 disponibles
- **DNS**: Acceso para configurar dominio

---

## 🚀 Instalación Automática

### Para Linux (Ubuntu/Debian)

```bash
# 1. Clonar o descargar el proyecto
cd /ruta/a/tu/proyecto

# 2. Dar permisos de ejecución
chmod +x scripts/install.sh

# 3. Ejecutar instalación automática
./scripts/install.sh
```

### Para Windows

```cmd
REM 1. Abrir PowerShell como Administrador
REM 2. Navegar al directorio del proyecto
cd C:\ruta\a\tu\proyecto

REM 3. Ejecutar instalación automática
scripts\install.bat
```

### 🔍 Qué hace la instalación automática:
- ✅ Instala Node.js y dependencias
- ✅ Configura nginx (Linux) o IIS (Windows)
- ✅ Instala certbot para SSL
- ✅ Configura base de datos SQLite
- ✅ Crea estructura de directorios
- ✅ Configura servicios del sistema
- ✅ Instala dependencias de npm
- ✅ Configura firewall básico

---

## ⚙️ Configuración Inicial

### 1. Configurar Variables de Entorno

```bash
# Copiar archivo de configuración
cp .env.example .env

# Editar configuración
nano .env    # Linux
notepad .env # Windows
```

### 2. Variables Críticas a Configurar

```env
# DOMINIO (Elige una opción)
# Opción A: DuckDNS (Gratis)
DOMAIN=mi-servicio.duckdns.org
DUCKDNS_DOMAIN=mi-servicio
DUCKDNS_TOKEN=tu-token-aqui

# Opción B: Dominio propio .com.ar
DOMAIN=mi-servicio.com.ar

# EMAIL SMTP (Gmail recomendado)
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password
SSL_EMAIL=tu-email@gmail.com

# SEGURIDAD
JWT_SECRET=clave-muy-segura-de-32-caracteres-minimo
SESSION_SECRET=otra-clave-segura-de-32-caracteres

# reCAPTCHA
RECAPTCHA_SITE_KEY=6Lc...
RECAPTCHA_SECRET_KEY=6Lc...

# WHATSAPP
WHATSAPP_NUMBER=5491112345678
```

### 3. Configurar Email (Gmail)

#### Generar App Password:
1. Ve a [Google Account Settings](https://myaccount.google.com/)
2. Seguridad → Verificación en 2 pasos (debe estar activada)
3. Contraseñas de aplicaciones
4. Generar nueva contraseña para "Mail"
5. Copiar la contraseña en `EMAIL_PASS`

### 4. Configurar reCAPTCHA

1. Ve a [Google reCAPTCHA](https://www.google.com/recaptcha/admin)
2. Crea un nuevo sitio
3. Selecciona reCAPTCHA v3
4. Agrega tu dominio
5. Copia las claves en el archivo `.env`

---

## 🌐 Configuración de Router

### 📡 Port Forwarding

Necesitas redirigir los puertos 80 y 443 de tu router a tu PC:

```
Puerto externo → Puerto interno → IP local
80             → 80             → 192.168.1.100
443            → 443            → 192.168.1.100
```

### 🔧 Pasos Generales (varia según router):

1. **Acceder al router**: Generalmente `192.168.1.1` o `192.168.0.1`
2. **Buscar sección**: "Port Forwarding", "NAT", "Virtual Server"
3. **Configurar reglas**:
   - Servicio: HTTP/HTTPS
   - Puerto externo: 80, 443
   - Puerto interno: 80, 443
   - IP destino: Tu IP local (ej: 192.168.1.100)
   - Protocolo: TCP

### 📱 Obtener tu IP Local:

**Linux/Mac:**
```bash
hostname -I
# o
ip addr show
```

**Windows:**
```cmd
ipconfig
```

### 🔍 Verificar Port Forwarding:

```bash
# Desde otra red (móvil con datos)
curl -I http://TU-IP-PUBLICA

# O usar herramientas online:
# https://www.canyouseeme.org/
```

---

## 🌍 Configuración DNS

### Opción A: DuckDNS (Recomendado - Gratis)

1. **Registrarse**: Ve a [DuckDNS.org](https://www.duckdns.org/)
2. **Iniciar sesión**: Con Google, GitHub o Twitter
3. **Crear subdominio**: Ejemplo: `mi-servicio-pc`
4. **Copiar token**: Aparece en la página principal
5. **Configurar**:
   ```bash
   # Ejecutar configuración automática
   ./scripts/dns-setup.sh
   ```

### Opción B: Dominio .com.ar

1. **Registrar dominio**: En [NIC Argentina](https://nic.ar/)
2. **Configurar DNS**:
   - Tipo A: `@` → Tu IP pública
   - Tipo A: `www` → Tu IP pública
3. **Esperar propagación**: 24-48 horas

### 🔄 Actualización Automática (solo DuckDNS)

El sistema actualiza automáticamente tu IP cada 5 minutos:

```bash
# Ver estado
./scripts/dns-check.sh

# Ver logs
tail -f logs/duckdns.log

# Actualizar manualmente
./scripts/update-duckdns.sh
```

---

## 🔐 Configuración SSL

### 🚀 Instalación Automática

```bash
# Configurar SSL automáticamente
./scripts/ssl-setup.sh
```

### 📋 Qué hace el script SSL:
- ✅ Obtiene certificados de Let's Encrypt
- ✅ Configura nginx con SSL
- ✅ Instala renovación automática
- ✅ Configura headers de seguridad
- ✅ Redirecciona HTTP → HTTPS

### 🔍 Verificar SSL:

```bash
# Verificar estado
./scripts/ssl-check.sh

# Test manual
curl -I https://tu-dominio.com

# Verificar renovación
sudo certbot renew --dry-run
```

### 🔄 Renovación Automática

Los certificados se renuevan automáticamente:
- **Frecuencia**: 2 veces al día
- **Vigencia**: 90 días
- **Renovación**: 30 días antes del vencimiento

---

## 🚀 Iniciar el Sistema

### Linux:
```bash
# Iniciar todos los servicios
./scripts/start.sh
```

### Windows:
```cmd
REM Iniciar servicios
scripts\start.bat
```

### ✅ Verificación del Inicio:

El script mostrará:
- 🌍 URL del sitio web
- 🔒 Estado SSL
- 📊 Estado de servicios
- 📱 Configuración WhatsApp
- 📧 Configuración email

---

## 🧪 Verificación y Pruebas

### 1. Health Check
```bash
curl https://tu-dominio.com/api/health
```

### 2. Formulario de Contacto
- Accede a tu sitio web
- Completa el formulario
- Verifica recepción de email

### 3. Verificaciones SSL
```bash
# Verificar certificado
openssl s_client -connect tu-dominio.com:443

# Test online
https://www.ssllabs.com/ssltest/
```

### 4. Verificar Logs
```bash
# Logs de la aplicación
tail -f logs/app.log

# Logs de nginx
sudo tail -f /var/log/nginx/reparacion_error.log

# Logs del sistema
sudo journalctl -u reparacion-pc -f
```

---

## 🆘 Resolución de Problemas

### 🚫 Error: Puerto 80/443 en uso

**Linux:**
```bash
# Ver qué usa el puerto
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Detener servicio conflictivo
sudo systemctl stop apache2  # Si Apache está instalado
```

**Windows:**
```cmd
REM Ver qué usa el puerto
netstat -ano | findstr :80
netstat -ano | findstr :443

REM Terminar proceso por PID
taskkill /F /PID [PID_NUMBER]
```

### 🌐 Error: Dominio no resolve

1. **Verificar DNS**:
   ```bash
   nslookup tu-dominio.com
   dig tu-dominio.com
   ```

2. **Verificar propagación**:
   - https://www.whatsmydns.net/
   - Esperar 5-10 minutos para DuckDNS
   - Hasta 48 horas para dominios .com.ar

3. **Verificar configuración**:
   ```bash
   ./scripts/dns-check.sh
   ```

### 🔐 Error: SSL no funciona

1. **Verificar certificados**:
   ```bash
   ./scripts/ssl-check.sh
   sudo certbot certificates
   ```

2. **Re-generar certificados**:
   ```bash
   sudo certbot delete --cert-name tu-dominio.com
   ./scripts/ssl-setup.sh
   ```

3. **Verificar nginx**:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### 📧 Error: Emails no se envían

1. **Verificar configuración SMTP**:
   ```bash
   # Test manual
   telnet smtp.gmail.com 587
   ```

2. **Verificar App Password**:
   - Debe ser una contraseña de aplicación
   - No la contraseña normal de Gmail
   - 2FA debe estar activado

3. **Verificar logs**:
   ```bash
   tail -f logs/app.log | grep -i email
   ```

### 🔥 Firewall bloquea conexiones

**Linux (UFW):**
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

**Windows:**
```cmd
REM Verificar reglas de firewall
netsh advfirewall firewall show rule name=all | findstr 80
```

### 🚫 Error: Permisos insuficientes

**Linux:**
```bash
# Asegurar permisos correctos
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh

# Verificar permisos de base de datos
chmod 644 database/contacts.db
```

### 🔌 Error: Node.js no inicia

1. **Verificar instalación**:
   ```bash
   node --version
   npm --version
   ```

2. **Verificar dependencias**:
   ```bash
   npm install
   ```

3. **Verificar archivo .env**:
   ```bash
   # Debe existir y tener configuración válida
   cat .env
   ```

4. **Iniciar en modo debug**:
   ```bash
   NODE_ENV=development node backend/server.js
   ```

### 📱 WhatsApp no funciona

1. **Verificar número**:
   ```
   Formato: 5491112345678
   Sin espacios, sin +, con código de país
   ```

2. **Test de enlace**:
   ```
   https://wa.me/5491112345678?text=test
   ```

---

## 📞 Soporte y Ayuda

### 📚 Documentación Adicional
- [DEPLOYMENT.md](DEPLOYMENT.md) - Guía de deployment
- [SECURITY.md](SECURITY.md) - Configuración de seguridad
- [MAINTENANCE.md](MAINTENANCE.md) - Mantenimiento

### 🔧 Comandos Útiles
```bash
# Ver estado general del sistema
./scripts/start.sh

# Verificar SSL
./scripts/ssl-check.sh

# Verificar DNS
./scripts/dns-check.sh

# Backup manual
./scripts/backup.sh

# Ver logs en tiempo real
tail -f logs/app.log
```

### 🆘 En caso de problemas graves
1. Hacer backup: `./scripts/backup.sh`
2. Revisar logs: `tail -f logs/app.log`
3. Reiniciar servicios: `sudo systemctl restart reparacion-pc nginx`
4. Si nada funciona, reinstalar: `./scripts/install.sh`

---

## ✅ Lista de Verificación Final

- [ ] ✅ Instalación automática completada
- [ ] ⚙️ Archivo .env configurado
- [ ] 🌐 Router con port forwarding configurado
- [ ] 🌍 DNS funcionando (ping a tu dominio)
- [ ] 🔐 SSL funcionando (https://)
- [ ] 📧 Email SMTP configurado
- [ ] 📱 WhatsApp configurado
- [ ] 🔥 Firewall configurado
- [ ] 🧪 Formulario de contacto funcionando
- [ ] 📊 Health check respondiendo
- [ ] 🔄 Backup automático funcionando

¡Con todos estos pasos completados, tu servicio de reparación PC estará online y funcionando! 🎉