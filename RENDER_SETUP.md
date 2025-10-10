# Guía de Configuración para Render

## 1. Configuración de Node.js

✅ **IMPORTANTE**: Este proyecto requiere **Node.js 20.x** (no usar Node 24)
- El archivo `.node-version` especifica la versión: `20.18.1`
- El `package.json` tiene configurado: `"node": "20.x"`

## 2. Variables de Entorno Obligatorias

Configura estas variables en: **Dashboard de Render → Environment → Add Environment Variable**

### Básicas (Servidor)
```bash
NODE_ENV=production
PORT=10000
```

### Dominio (se actualiza automáticamente al desplegar)
```bash
DOMAIN=tu-app.onrender.com
BASE_URL=https://tu-app.onrender.com
```

### Base de Datos
```bash
DB_PATH=./database/contacts.db
```

### Seguridad (GENERAR VALORES ÚNICOS)
```bash
# Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=GENERAR_STRING_ALEATORIO_32_CARACTERES_MINIMO
SESSION_SECRET=GENERAR_OTRO_STRING_ALEATORIO_32_CARACTERES
COOKIE_HASH_KEY=GENERAR_OTRO_STRING_ALEATORIO_DIFERENTE
```

### reCAPTCHA v3
```bash
# Obtener en: https://www.google.com/recaptcha/admin
RECAPTCHA_SITE_KEY=tu-site-key-aqui
RECAPTCHA_SECRET_KEY=tu-secret-key-aqui
RECAPTCHA_THRESHOLD=0.5
```

### Email SMTP (Gmail recomendado)
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password-gmail
EMAIL_TO=tu-email@gmail.com
EMAIL_FROM_NAME=Servicio Reparación PC
EMAIL_SUBJECT=Consulta recibida - Servicio Reparación PC
```

**Nota Gmail App Password:**
1. Ve a: https://myaccount.google.com/security
2. Habilita verificación en 2 pasos
3. Busca "App passwords"
4. Genera una contraseña para "Correo" → "Otro (nombre personalizado)"
5. Copia el código de 16 caracteres generado

### WhatsApp
```bash
WHATSAPP_NUMBER=5491112345678
WHATSAPP_MESSAGE=Hola! Vi tu página web y necesito ayuda con mi
```

### Rate Limiting
```bash
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=3
GENERAL_RATE_LIMIT_WINDOW_MS=60000
GENERAL_RATE_LIMIT_MAX_REQUESTS=30
```

## 3. Variables Opcionales (Recomendadas)

### Logging
```bash
LOG_LEVEL=info
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10
LOG_MAX_FILES=5
```

### Regional
```bash
TZ=America/Argentina/Buenos_Aires
LOCALE=es-AR
CURRENCY=ARS
```

### Cache
```bash
ENABLE_MEMORY_CACHE=true
CACHE_TTL=3600
CACHE_MAX_SIZE=100
```

### Personalización
```bash
SERVICE_NAME=Servicio Reparación PC
TECHNICIAN_NAME=Tu Nombre
YEARS_EXPERIENCE=5
COVERAGE_AREA=Buenos Aires, Argentina
```

## 4. Configuración de CORS

Después del primer deploy, actualiza:
```bash
CORS_ORIGIN=https://tu-app.onrender.com
```

## 5. Comandos para Generar Secretos

### En tu terminal local:
```bash
# Para JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Para SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Para COOKIE_HASH_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 6. Persistencia de Base de Datos

⚠️ **IMPORTANTE**: El plan gratuito de Render NO persiste archivos entre deploys.

### Opción 1: Persistent Disk (Recomendado)
1. En Render Dashboard → tu servicio → Disks
2. Click "Add Disk"
3. Nombre: `database`
4. Mount Path: `/var/data`
5. Size: 1 GB (suficiente para SQLite)
6. Actualizar variable: `DB_PATH=/var/data/contacts.db`

### Opción 2: PostgreSQL (Alternativa)
Si prefieres PostgreSQL en lugar de SQLite:
1. Crear servicio PostgreSQL en Render
2. Migrar código de SQLite a PostgreSQL
3. Usar variable de entorno `DATABASE_URL` automática

## 7. Health Check

El endpoint `/api/health` debe responder correctamente:
- Render lo usa para verificar que el servicio está funcionando
- Configurado en `render.yaml`

## 8. Pasos de Deploy

1. **Conectar repositorio GitHub a Render**
2. **Configurar todas las variables de entorno**
3. **Configurar Persistent Disk (si aplica)**
4. **Deploy manual** o esperar auto-deploy
5. **Verificar logs** en Render Dashboard
6. **Probar** el endpoint: `https://tu-app.onrender.com/api/health`

## 9. Verificación Post-Deploy

### Checklist:
- [ ] El servicio inicia sin errores
- [ ] `/api/health` responde 200 OK
- [ ] El formulario de contacto funciona
- [ ] Los emails se envían correctamente
- [ ] reCAPTCHA funciona
- [ ] WhatsApp button funciona

### Logs útiles:
```bash
# Ver logs en tiempo real en Render Dashboard → Logs
# O usar Render CLI:
render logs -f
```

## 10. Troubleshooting

### Error: "better-sqlite3 compilation failed"
- ✅ Solucionado: usando Node 20.x en `.node-version`

### Error: "Database locked"
- Asegúrate de tener Persistent Disk configurado
- Verifica permisos de escritura en `/var/data`

### Error: "Health check failed"
- Verifica que el endpoint `/api/health` responda
- Revisa logs para errores de inicio

### Error: "CORS blocked"
- Actualiza `CORS_ORIGIN` con tu dominio de Render
- Verifica que incluye `https://`

## 11. Scripts Útiles

### Actualizar dependencias localmente antes de deploy:
```bash
npm update
npm audit fix
```

### Probar build local:
```bash
npm install
npm start
```

### Verificar health endpoint:
```bash
curl https://tu-app.onrender.com/api/health
```

## 12. Monitoreo y Alertas

### Render ofrece:
- Logs en tiempo real
- Métricas de CPU/RAM
- Uptime monitoring
- Email alerts (configurable)

### Configurar alertas:
1. Render Dashboard → tu servicio → Settings
2. Notification Settings
3. Agregar email para alertas de deploy y downtime

---

## 📞 Soporte

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- GitHub Issues: tu-repositorio/issues
