# 🚀 Guía de Deploy en Vercel

Esta guía te ayudará a deployar tu aplicación en Vercel después de la migración desde self-hosting.

---

## 📋 Pre-requisitos

- [ ] Cuenta en Vercel (https://vercel.com)
- [ ] Cuenta en Supabase (https://supabase.com) - Ya configurada ✅
- [ ] Gmail con App Password para emails
- [ ] reCAPTCHA v3 Site Key y Secret Key
- [ ] Repositorio Git configurado

---

## 🔧 Paso 1: Configurar Variables de Entorno en Vercel

### Opción A: Desde la Terminal (Recomendado)

```bash
# Instala Vercel CLI si no lo tienes
npm install -g vercel

# Login a Vercel
vercel login

# Link tu proyecto
vercel link

# Agrega las variables de entorno
vercel env add SUPABASE_URL production
# Valor: https://zfgzhprxvmrydmjjcyjl.supabase.co

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Valor: [TU SERVICE ROLE KEY - ROTAR POR SEGURIDAD]

vercel env add RECAPTCHA_SITE_KEY production
# Valor: [Tu site key de Google reCAPTCHA]

vercel env add RECAPTCHA_SECRET_KEY production
# Valor: [Tu secret key de Google reCAPTCHA]

vercel env add RECAPTCHA_THRESHOLD production
# Valor: 0.5

vercel env add EMAIL_HOST production
# Valor: smtp.gmail.com

vercel env add EMAIL_PORT production
# Valor: 587

vercel env add EMAIL_SECURE production
# Valor: false

vercel env add EMAIL_USER production
# Valor: [tu-email@gmail.com]

vercel env add EMAIL_PASS production
# Valor: [tu app password de Gmail]

vercel env add EMAIL_TO production
# Valor: [email donde recibes consultas]

vercel env add WHATSAPP_NUMBER production
# Valor: 5491112345678 (sin + ni espacios)

vercel env add NODE_ENV production
# Valor: production
```

### Opción B: Desde el Dashboard de Vercel

1. Ve a tu proyecto en https://vercel.com/dashboard
2. Click en "Settings" > "Environment Variables"
3. Agrega cada variable con su valor correspondiente
4. Marca "Production" para cada variable

---

## 🌐 Paso 2: Deploy

### Deploy desde Terminal

```bash
# Preview deploy (para testing)
vercel

# Production deploy
vercel --prod
```

### Deploy desde Git (Automático)

1. Push tu código a GitHub/GitLab/Bitbucket:
```bash
git push origin main
```

2. Vercel detectará el push y desplegará automáticamente

---

## ✅ Paso 3: Verificar el Deploy

### 1. Health Check
```bash
curl https://tu-dominio.vercel.app/api/health
```

Deberías ver:
```json
{
  "status": "healthy",
  "services": {
    "database": "healthy",
    "email": "healthy"
  }
}
```

### 2. Probar Formulario de Contacto
- Visita https://tu-dominio.vercel.app
- Completa el formulario de contacto
- Verifica que llegue el email

### 3. Revisar Logs
```bash
vercel logs
```

---

## 🔒 Paso 4: Seguridad Post-Deploy

### ⚠️ CRÍTICO: Rotar Service Role Key de Supabase

1. Ve a: https://supabase.com/dashboard/project/zfgzhprxvmrydmjjcyjl/settings/api
2. Click en "Reset service_role key"
3. Copia la nueva key
4. Actualiza en Vercel:
```bash
vercel env rm SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Pega la nueva key
```

### Configurar Dominio Custom (Opcional)

1. En Vercel Dashboard > Settings > Domains
2. Agrega tu dominio (ej: reparaciones-pc.com.ar)
3. Configura los DNS según las instrucciones de Vercel

---

## 📊 Paso 5: Configurar Tablas en Supabase

### Verifica que existan estas tablas:

1. **contacts** - Almacena formularios de contacto
2. **security_logs** - Logs de seguridad
3. **blocked_ips** - IPs bloqueadas
4. **rate_limits** - Control de rate limiting
5. **page_visits** - Analytics de visitas
6. **whatsapp_clicks** - Clicks en WhatsApp

### Script SQL (si faltan tablas):

```sql
-- Ver archivo database/schema.sql en la carpeta archived/
-- O ejecutar desde Supabase SQL Editor
```

---

## 🎯 Endpoints Disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/contact/submit` | POST | Enviar formulario |
| `/api/contact/config` | GET | Configuración del formulario |
| `/api/analytics/visit` | POST | Registrar visita |
| `/api/analytics/whatsapp-click` | POST | Registrar click WhatsApp |
| `/admin` | GET | Panel administrativo |
| `/` | GET | Página principal |

---

## 🐛 Troubleshooting

### Error: "SUPABASE_URL not defined"
- Verifica que las variables de entorno estén configuradas
- Ejecuta: `vercel env pull` para verificar localmente

### Error: "Failed to send email"
- Verifica el App Password de Gmail
- Asegúrate que 2FA esté activado en Gmail
- Prueba el servicio: `curl https://tu-dominio.vercel.app/api/health`

### Error: "reCAPTCHA verification failed"
- Verifica las keys de reCAPTCHA
- Asegúrate que el dominio esté autorizado en Google reCAPTCHA

### Funciones Serverless Timeout
- Las funciones tienen 10s máximo (configurado en vercel.json)
- Si necesitas más tiempo, actualiza `maxDuration` en vercel.json

---

## 📈 Monitoreo

### Vercel Analytics
- https://vercel.com/tu-proyecto/analytics

### Logs en Tiempo Real
```bash
vercel logs --follow
```

### Supabase Dashboard
- https://supabase.com/dashboard/project/zfgzhprxvmrydmjjcyjl

---

## 🔄 Rollback (Si algo sale mal)

### Volver a la versión anterior:
```bash
vercel rollback
```

### Volver a Self-Hosting:
```bash
git checkout archive-self-hosting
# Restaurar backend/ a la raíz
git checkout archive-self-hosting -- backend/
```

---

## 📚 Recursos

- [Documentación Vercel](https://vercel.com/docs)
- [Documentación Supabase](https://supabase.com/docs)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## ✨ Arquitectura Actual

```
┌─────────────────────────────────────────────┐
│           Vercel (Hosting + CDN)            │
├─────────────────────────────────────────────┤
│                                             │
│  Frontend:                                  │
│  ├─ index.html (/)                         │
│  ├─ admin.html (/admin)                    │
│  └─ Static assets (/css, /js, /images)     │
│                                             │
│  API (Serverless Functions):               │
│  ├─ /api/health.js                         │
│  ├─ /api/contact/submit.js                 │
│  ├─ /api/contact/config.js                 │
│  ├─ /api/analytics/visit.js                │
│  └─ /api/analytics/whatsapp-click.js       │
│                                             │
│  Shared Utils:                              │
│  └─ /api/_shared/                           │
│      ├─ supabase-db.js                      │
│      ├─ logger.js                           │
│      ├─ email.js                            │
│      ├─ validator.js                        │
│      └─ security.js                         │
└─────────────────────────────────────────────┘
                    ↓
        ┌───────────────────────┐
        │   Supabase (Database) │
        │   - PostgreSQL        │
        │   - Auth              │
        │   - Storage           │
        └───────────────────────┘
```

---

## 🎉 ¡Deploy Exitoso!

Una vez completados todos los pasos, tu aplicación estará en producción en Vercel con:
- ✅ Serverless functions auto-escalables
- ✅ CDN global
- ✅ SSL automático
- ✅ Deploy automático desde Git
- ✅ Base de datos en Supabase
- ✅ Monitoreo y analytics

---

**Generado con Claude Code** 🤖
