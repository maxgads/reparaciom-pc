# 🚀 Guía de Inicio Rápido - Reparaciones PC

## ✅ Tu aplicación está LISTA para usar

He completado todas las mejoras que pediste:

### 🎯 **Datos reales en panel de administrador**
- ✅ Conectado a base de datos real (no más datos falsos)
- ✅ Tracking automático de visitas a páginas
- ✅ Conteo real de clics en WhatsApp
- ✅ Gráficos con datos históricos reales
- ✅ Lista de contactos reales del formulario

### 🔄 **Sistema para mantener siempre activa**
- ✅ PM2 configurado para auto-restart
- ✅ Endpoint `/api/webhook/keepalive` para n8n/Make
- ✅ Script de monitoreo automático
- ✅ Health checks cada 5 minutos

### 🌐 **Acceso desde internet**
- ✅ Configuración para ngrok (más rápido)
- ✅ Opciones de hosting gratuito (Railway, Render)
- ✅ Guía completa para VPS

---

## 🎮 ¿Cómo usar tu aplicación?

### **Opción 1: Inicio Super Rápido (2 minutos)**

```bash
# 1. Instalar ngrok (si no lo tienes)
sudo snap install ngrok

# 2. Iniciar tu app con túnel público
./scripts/start-ngrok.sh
```

Esto te dará:
- ✅ URL pública tipo: `https://abc123.ngrok.io`
- ✅ Panel admin: `https://abc123.ngrok.io/admin.html`
- ✅ Keep-alive automático funcionando
- ✅ Logs en tiempo real

### **Opción 2: Hosting Gratuito Permanente**

1. **Railway (Recomendado)**
   ```bash
   npm install -g @railway/cli
   railway login
   railway new
   railway up
   ```

2. **Render**
   - Conectar repositorio en render.com
   - Build: `npm install`
   - Start: `npm start`

### **Opción 3: VPS Profesional**
Ver guía completa en: `scripts/deploy-options.md`

---

## 📊 Panel de Administrador

### **Acceso:**
- URL: `tu-dominio.com/admin.html`
- Usuario: `admin`
- Contraseña: `repara2024`

### **Datos Reales que verás:**
- **Visitas totales**: Contador real de visitantes
- **Consultas**: Formularios enviados reales
- **Visitas hoy**: Contador diario
- **Clics WhatsApp**: Rastreo de botones WhatsApp
- **Gráfico de visitas**: Últimos 7 días con datos reales
- **Páginas populares**: Qué secciones visitan más
- **Lista de contactos**: Todos los formularios recibidos

---

## 🤖 Integración con n8n/Make

### **URL del webhook:**
```
GET/POST: https://tu-dominio.com/api/webhook/keepalive
```

### **n8n Workflow (cada 5 minutos):**
```json
{
  "nodes": [
    {
      "type": "Cron",
      "expression": "*/5 * * * *"
    },
    {
      "type": "HTTP Request",
      "url": "https://tu-dominio.com/api/webhook/keepalive",
      "method": "GET"
    }
  ]
}
```

### **Make.com Scenario:**
1. **HTTP Module** → GET request cada 5 min
2. **Router** → Si falla el request
3. **Gmail/Slack** → Notificación de error

---

## 🔍 Comandos útiles

```bash
# Ver estado de la app
curl https://tu-dominio.com/api/health

# Test keep-alive
curl https://tu-dominio.com/api/webhook/keepalive

# Iniciar con PM2 (para producción)
pm2 start ecosystem.config.js --env production
pm2 start scripts/monitor-keepalive.js --name "keepalive"

# Ver logs
pm2 logs
tail -f logs/combined-$(date +%Y-%m-%d).log
```

---

## 📈 Cómo generar datos de prueba

Una vez que tu app esté online:

1. **Visita tu página** → Se registrarán automáticamente
2. **Haz clic en botones WhatsApp** → Se contarán automáticamente  
3. **Llena el formulario** → Aparecerá en el admin
4. **Navega por secciones** → Se trackea automáticamente

### **Para generar datos más rápido:**
```javascript
// Ejecuta en consola del navegador en tu página:
for(let i=0; i<5; i++) {
    window.analytics.trackPageVisit('/#servicios');
    window.trackWhatsAppClick('notebook');
}
```

---

## 🎉 ¡YA ESTÁ LISTO!

Tu aplicación ahora tiene:
- ✅ **Datos reales** en lugar de falsos
- ✅ **Sistema keep-alive** para mantenerla activa
- ✅ **3 opciones de hosting** (local, gratuito, profesional)
- ✅ **Integración con n8n/Make** lista
- ✅ **Analytics automáticas** funcionando
- ✅ **Panel admin profesional**

### **Próximo paso:**
Ejecuta `./scripts/start-ngrok.sh` y en 2 minutos tendrás tu app online con URL pública.

### **Preguntas frecuentes:**

**❓ ¿Cómo cambio usuario/password del admin?**
Edita líneas 179-182 en `frontend/admin.html`

**❓ ¿Cómo personalizo el mensaje de WhatsApp?**
Edita la variable `WHATSAPP_MESSAGE_TEMPLATE` en `.env`

**❓ ¿Cómo configuro email para recibir consultas?**
Edita `EMAIL_USER` y `EMAIL_PASS` en `.env` con tu Gmail y App Password

**❓ ¿Se pierden los datos si se reinicia?**
No, todo se guarda en SQLite (`database/contacts.db`)