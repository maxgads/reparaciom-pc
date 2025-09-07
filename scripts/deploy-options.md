# 🚀 Opciones de Deployment para Reparaciones PC

## Opción 1: Localhost con ngrok (Más Rápido - Para Pruebas)

### Paso 1: Instalar ngrok
```bash
# Ubuntu/Debian
sudo snap install ngrok

# Con npm
npm install -g ngrok

# Registrarse en https://ngrok.com y obtener token
ngrok authtoken TU_TOKEN_AQUI
```

### Paso 2: Ejecutar aplicación
```bash
# Terminal 1: Iniciar la aplicación
npm start

# Terminal 2: Crear túnel público
ngrok http 3000
```

### Paso 3: URL pública
ngrok te dará una URL como: `https://abc123.ngrok.io`

**✅ Ventajas:**
- Configuración en 2 minutos
- Perfecto para pruebas y demos
- Funciona inmediatamente

**❌ Desventajas:**
- Tu PC debe estar siempre encendida
- URL cambia cada vez que reinicias ngrok
- Limitaciones en versión gratuita

---

## Opción 2: Railway (Hosting Gratuito)

### Paso 1: Preparar para Railway
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login
```

### Paso 2: Crear proyecto en Railway
```bash
# Crear proyecto
railway new

# Conectar repositorio
railway link
```

### Paso 3: Configurar variables de entorno
En Railway Dashboard, agregar:
- `NODE_ENV=production`
- `PORT=3000`
- Todas las variables de tu .env

### Paso 4: Desplegar
```bash
railway up
```

**✅ Ventajas:**
- Completamente gratis hasta 5$/mes de uso
- SSL automático
- Dominio personalizado
- Base de datos incluida

**❌ Desventajas:**
- Se duerme después de 30 min de inactividad
- Limitaciones de CPU/memoria

---

## Opción 3: VPS con DigitalOcean (Recomendado para Producción)

### Paso 1: Crear Droplet ($5/mes)
1. Ir a DigitalOcean.com
2. Crear droplet Ubuntu 22.04
3. Configurar SSH key

### Paso 2: Configurar servidor
```bash
# Conectar por SSH
ssh root@tu-ip-del-servidor

# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Instalar PM2 globalmente
npm install -g pm2

# Instalar nginx
apt install nginx -y

# Instalar certbot para SSL
apt install certbot python3-certbot-nginx -y
```

### Paso 3: Subir código
```bash
# En tu PC local
scp -r ./REPARACIONEs root@tu-ip:/var/www/

# En el servidor
cd /var/www/REPARACIONEs
npm install --production
```

### Paso 4: Configurar dominio
```bash
# Configurar nginx
nano /etc/nginx/sites-available/reparaciones-pc

# Contenido del archivo:
server {
    listen 80;
    server_name tu-dominio.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Activar sitio
ln -s /etc/nginx/sites-available/reparaciones-pc /etc/nginx/sites-enabled/
systemctl reload nginx

# Configurar SSL
certbot --nginx -d tu-dominio.com
```

### Paso 5: Iniciar con PM2
```bash
# Iniciar aplicación
pm2 start ecosystem.config.js --env production

# Guardar configuración PM2
pm2 save
pm2 startup

# Iniciar monitor keep-alive
pm2 start scripts/monitor-keepalive.js --name "keepalive-monitor"
```

**✅ Ventajas:**
- Control total del servidor
- Siempre activa 24/7
- Dominio personalizado
- Escalabilidad completa

**❌ Desventajas:**
- Costo mensual ($5-10)
- Requiere conocimientos de servidor
- Mantenimiento manual

---

## Opción 4: Render (Hosting Gratuito con Limitaciones)

### Paso 1: Conectar repositorio
1. Ir a render.com
2. Conectar tu repositorio GitHub/GitLab

### Paso 2: Configurar web service
- Build Command: `npm install`
- Start Command: `npm start`
- Environment: Node.js

### Paso 3: Variables de entorno
Agregar todas las variables de tu .env

**✅ Ventajas:**
- Deploy automático desde Git
- SSL gratis
- Fácil configuración

**❌ Desventajas:**
- Se duerme después de inactividad
- Arranque lento después del sueño

---

## ⚡ Configuración para n8n/Make

### Webhook URLs para mantener activa:
```
GET/POST: https://tu-dominio.com/api/webhook/keepalive
```

### n8n Workflow (cada 5 minutos):
1. **Cron Trigger**: `*/5 * * * *`
2. **HTTP Request**: GET a tu webhook
3. **If Node**: Verificar si status === 'alive'
4. **Slack/Email**: Alerta si falla

### Make.com Scenario:
1. **Webhook**: Trigger cada 5 minutos
2. **HTTP Module**: GET request
3. **Router**: Verificar respuesta
4. **Gmail**: Enviar email si error

---

## 🎯 Recomendación por Uso

### Para Pruebas y Desarrollo:
**ngrok** - Configuración inmediata, perfecto para mostrar a clientes

### Para MVP/Startup:
**Railway** - Gratis, fácil, con posibilidad de upgrade

### Para Negocio Serio:
**DigitalOcean VPS** - Control total, siempre activa, profesional

### Para Portfolio/Demo:
**Render** - Balance entre facilidad y funcionalidad

---

## 📋 Checklist de Deploy

- [ ] Variables de entorno configuradas
- [ ] Base de datos inicializada
- [ ] SSL configurado (HTTPS)
- [ ] Dominio apuntando correctamente
- [ ] PM2 configurado para auto-restart
- [ ] Monitor keep-alive ejecutándose
- [ ] Backup automático activo
- [ ] Health checks funcionando
- [ ] n8n/Make webhook configurado