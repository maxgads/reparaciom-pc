# 🏠 Guía de Self-Hosting - Reparación PC

## 📋 ¿Qué necesitas?

### **Hardware mínimo:**
- PC con Linux (Ubuntu/Debian) o Raspberry Pi
- 2 GB RAM mínimo
- 10 GB espacio en disco
- Conexión a internet estable

### **Software:**
- Ubuntu 20.04+ o Debian 11+
- Acceso root/sudo

### **Red:**
- Router con acceso para configurar port forwarding
- IP pública (aunque sea dinámica)

---

## 🚀 INSTALACIÓN COMPLETA (AUTOMÁTICA)

### Paso 1: Clonar el repositorio
```bash
git clone https://github.com/maxgads/reparaciom-pc.git
cd reparaciom-pc
```

### Paso 2: Ejecutar instalación automática
```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

Esto instalará:
- ✅ Node.js y npm
- ✅ Nginx (servidor web)
- ✅ Certbot (SSL gratis con Let's Encrypt)
- ✅ SQLite3
- ✅ Firewall (ufw)
- ✅ Fail2ban (protección contra ataques)
- ✅ Todas las dependencias del proyecto

---

## ⚙️ CONFIGURACIÓN

### Paso 3: Configurar variables de entorno

1. **Copia el archivo de ejemplo:**
```bash
cp .env.example .env
nano .env
```

2. **Configura estas variables CRÍTICAS:**

```env
# Servidor
PORT=3000
NODE_ENV=production

# Dominio (después de configurar DuckDNS)
DOMAIN=tu-subdominio.duckdns.org
BASE_URL=https://tu-subdominio.duckdns.org

# Base de datos
DB_PATH=./database/contacts.db

# SEGURIDAD - Genera con: node scripts/generate-secrets.js
JWT_SECRET=PEGAR_SECRETO_GENERADO
SESSION_SECRET=PEGAR_SECRETO_GENERADO
COOKIE_HASH_KEY=PEGAR_SECRETO_GENERADO

# Email (Gmail con App Password)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password-de-16-caracteres
EMAIL_TO=tu-email@gmail.com

# reCAPTCHA v3 (configurar después)
RECAPTCHA_SITE_KEY=tu-site-key
RECAPTCHA_SECRET_KEY=tu-secret-key
RECAPTCHA_THRESHOLD=0.5

# WhatsApp
WHATSAPP_NUMBER=5491112345678

# DuckDNS (DNS dinámico gratuito)
DUCKDNS_DOMAIN=tu-subdominio
DUCKDNS_TOKEN=tu-token-duckdns

# SSL
SSL_EMAIL=tu-email@gmail.com
```

3. **Guardar y salir:** `Ctrl+X`, luego `Y`, luego `Enter`

---

## 🌐 CONFIGURAR DNS DINÁMICO (DuckDNS)

### Paso 4: Crear cuenta en DuckDNS

1. Ve a: https://www.duckdns.org/
2. Inicia sesión con tu cuenta de Google/GitHub
3. Crea un subdominio (ejemplo: `mi-reparacion-pc`)
4. **Copia tu token** (aparece arriba)
5. Actualiza el `.env` con:
   ```env
   DUCKDNS_DOMAIN=mi-reparacion-pc
   DUCKDNS_TOKEN=el-token-que-copiaste
   DOMAIN=mi-reparacion-pc.duckdns.org
   BASE_URL=https://mi-reparacion-pc.duckdns.org
   ```

### Paso 5: Configurar actualización automática de DNS
```bash
chmod +x scripts/dns-setup.sh
./scripts/dns-setup.sh
```

Esto configurará un cron job que actualiza tu IP cada 5 minutos en DuckDNS.

---

## 🔐 CONFIGURAR PORT FORWARDING EN TU ROUTER

### Paso 6: Abrir puertos en el router

**Necesitas redirigir estos puertos a la IP local de tu PC/Raspberry Pi:**

| Puerto Externo | Puerto Interno | Protocolo | Servicio |
|----------------|----------------|-----------|----------|
| 80 | 80 | TCP | HTTP |
| 443 | 443 | TCP | HTTPS |

**Cómo hacerlo:**

1. **Encuentra la IP local de tu servidor:**
   ```bash
   ip addr show | grep "inet "
   # Busca algo como: 192.168.1.XXX o 192.168.0.XXX
   ```

2. **Accede al router:**
   - Abre navegador → `192.168.1.1` o `192.168.0.1`
   - Usuario/contraseña: ver etiqueta del router o manual
   - Común: `admin/admin`, `admin/password`, `admin/1234`

3. **Busca la sección de Port Forwarding:**
   - Puede llamarse: "Port Forwarding", "NAT", "Virtual Server", "Aplicaciones"

4. **Agrega las reglas:**
   ```
   Nombre: HTTP
   Puerto Externo: 80
   Puerto Interno: 80
   IP Interna: 192.168.1.XXX (la IP de tu servidor)
   Protocolo: TCP

   Nombre: HTTPS
   Puerto Externo: 443
   Puerto Interno: 443
   IP Interna: 192.168.1.XXX
   Protocolo: TCP
   ```

5. **Guarda y reinicia el router** si es necesario

---

## 🔒 CONFIGURAR SSL (HTTPS)

### Paso 7: Instalar certificado SSL gratuito

**Espera 5-10 minutos** después de configurar DuckDNS y port forwarding.

```bash
chmod +x scripts/ssl-setup.sh
./scripts/ssl-setup.sh
```

Esto:
- ✅ Verifica que tu dominio apunte a tu IP
- ✅ Obtiene certificado SSL gratis de Let's Encrypt
- ✅ Configura renovación automática
- ✅ Configura Nginx con SSL

---

## 📧 CONFIGURAR EMAIL (Gmail)

### Paso 8: Crear App Password de Gmail

1. Ve a: https://myaccount.google.com/security
2. Activa "Verificación en 2 pasos" (si no está)
3. Ve a: https://myaccount.google.com/apppasswords
4. Crea nueva contraseña:
   - App: **Correo**
   - Dispositivo: **Otro** → "Servicio Reparación PC"
5. Copia el código de 16 caracteres
6. Actualiza en `.env`:
   ```env
   EMAIL_PASS=el-codigo-sin-espacios
   ```

---

## 🛡️ CONFIGURAR reCAPTCHA

### Paso 9: Crear reCAPTCHA v3

1. Ve a: https://www.google.com/recaptcha/admin/create
2. Configuración:
   ```
   Etiqueta: Servicio Reparación PC
   Tipo: reCAPTCHA v3
   Dominios:
     - tu-subdominio.duckdns.org
     - localhost (para testing)
   ```
3. Click en "Enviar"
4. Copia las claves y actualiza en `.env`:
   ```env
   RECAPTCHA_SITE_KEY=la-clave-del-sitio
   RECAPTCHA_SECRET_KEY=la-clave-secreta
   ```

---

## 🚀 INICIAR EL SISTEMA

### Paso 10: Iniciar todos los servicios

```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

Esto:
- ✅ Verifica configuración
- ✅ Inicia Nginx
- ✅ Inicia aplicación Node.js
- ✅ Actualiza DNS
- ✅ Hace health check
- ✅ Muestra estado del sistema

---

## ✅ VERIFICAR QUE FUNCIONA

### Paso 11: Pruebas

1. **Desde tu navegador:**
   ```
   https://tu-subdominio.duckdns.org
   ```

2. **Health check:**
   ```
   https://tu-subdominio.duckdns.org/api/health
   ```
   Deberías ver: `{"status":"ok",...}`

3. **Probar formulario de contacto**

4. **Verificar que llegue el email**

---

## 📊 COMANDOS ÚTILES

### Ver logs en tiempo real:
```bash
sudo journalctl -u reparacion-pc -f
```

### Ver estado del servicio:
```bash
sudo systemctl status reparacion-pc
```

### Reiniciar servicio:
```bash
sudo systemctl restart reparacion-pc
```

### Detener todo:
```bash
sudo systemctl stop reparacion-pc nginx
```

### Ver logs de Nginx:
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Renovar SSL manualmente:
```bash
sudo certbot renew --nginx
```

### Ver IPs bloqueadas:
```bash
sudo fail2ban-client status
```

---

## 🔧 MANTENIMIENTO

### Backups automáticos:
El sistema hace backups diarios de la base de datos automáticamente.

Ver backups:
```bash
ls -lh backups/
```

Restaurar backup:
```bash
./scripts/restore.sh backups/contacts-YYYY-MM-DD.db
```

### Actualizar el sistema:
```bash
cd reparaciom-pc
git pull
npm install
sudo systemctl restart reparacion-pc
```

---

## 🆘 TROUBLESHOOTING

### El sitio no es accesible desde internet:

1. **Verifica port forwarding:**
   ```bash
   # Desde otro dispositivo, prueba:
   curl http://tu-ip-publica
   ```

2. **Verifica DuckDNS:**
   ```bash
   nslookup tu-subdominio.duckdns.org
   # Debe mostrar tu IP pública
   ```

3. **Verifica firewall:**
   ```bash
   sudo ufw status
   # Debe mostrar 80/tcp y 443/tcp ALLOW
   ```

### El servidor no inicia:

```bash
# Ver logs detallados:
sudo journalctl -u reparacion-pc -n 50 --no-pager

# Verificar puerto:
sudo netstat -tulpn | grep :3000

# Verificar archivo .env:
cat .env | grep -v "^#" | grep -v "^$"
```

### Problemas con SSL:

```bash
# Verificar certificados:
sudo certbot certificates

# Renovar forzado:
sudo certbot renew --force-renewal

# Ver logs de certbot:
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### Base de datos corrupta:

```bash
# Verificar integridad:
sqlite3 database/contacts.db "PRAGMA integrity_check;"

# Restaurar desde backup:
cp backups/contacts-LATEST.db database/contacts.db
sudo systemctl restart reparacion-pc
```

---

## 💰 COSTOS ESTIMADOS

### Self-hosting con PC/Raspberry Pi en casa:

| Ítem | Costo |
|------|-------|
| Hardware (si ya lo tienes) | $0 |
| Electricidad (~5W, 24/7/365) | ~$2-5 USD/año |
| DuckDNS | Gratis |
| SSL (Let's Encrypt) | Gratis |
| **TOTAL** | **~$0.20-0.40 USD/mes** |

### Comparado con hosting pago:
- Render: $7/mes
- Railway: $5-10/mes
- VPS: $4-10/mes

---

## 📞 SOPORTE

Si algo no funciona:

1. Ejecuta el diagnóstico:
   ```bash
   ./scripts/troubleshoot.sh
   ```

2. Revisa los logs:
   ```bash
   sudo journalctl -u reparacion-pc --since today
   ```

3. Verifica la configuración:
   ```bash
   ./scripts/health-check.sh
   ```

---

## 🎉 ¡Listo!

Tu sitio web profesional de reparación de PC está funcionando 24/7 desde tu casa, completamente gratis (excepto electricidad).

**Ventajas del self-hosting:**
- ✅ Control total
- ✅ Sin costos mensuales
- ✅ Base de datos persistente
- ✅ Sin límites de requests
- ✅ Aprenderás mucho
- ✅ Escalable cuando quieras
