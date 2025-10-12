# Guía de Migración a Vercel + Supabase

Esta guía te ayudará a migrar tu aplicación de reparación de PC desde un servidor local con SQLite a Vercel con Supabase (PostgreSQL).

## Ventajas de esta migración

- ✅ Sin necesidad de configurar DNS dinámico, SSL, o firewall
- ✅ Hosting gratuito en Vercel
- ✅ Base de datos PostgreSQL gratuita en Supabase (más robusta que SQLite)
- ✅ Escalabilidad automática
- ✅ HTTPS por defecto
- ✅ Deploy automático con Git
- ✅ Sin necesidad de hacer bridge con el servicio de internet

---

## Paso 1: Crear cuenta en Supabase

1. Ve a https://supabase.com y crea una cuenta gratuita
2. Crea un nuevo proyecto:
   - Nombre del proyecto: `reparacion-pc` (o el que prefieras)
   - Database Password: Guarda esta contraseña de forma segura
   - Region: Selecciona `South America (São Paulo)` para mejor rendimiento

3. Espera a que el proyecto se cree (toma unos 2-3 minutos)

---

## Paso 2: Configurar la base de datos en Supabase

1. En el dashboard de Supabase, ve a **SQL Editor**

2. Copia y pega el contenido del archivo `/database/supabase-schema.sql` en el editor

3. Haz clic en **RUN** para ejecutar el script

4. Verifica que las tablas se crearon correctamente yendo a **Table Editor**

   Deberías ver estas tablas:
   - `contacts`
   - `security_logs`
   - `blocked_ips`
   - `rate_limits`
   - `system_stats`
   - `page_visits`
   - `whatsapp_clicks`

---

## Paso 3: Obtener las credenciales de Supabase

1. En Supabase, ve a **Project Settings** > **API**

2. Copia estos valores (los necesitarás después):
   - **Project URL** (SUPABASE_URL)
   - **service_role** key (SUPABASE_SERVICE_ROLE_KEY) - **¡No uses el anon key!**

---

## Paso 4: Crear cuenta en Vercel

1. Ve a https://vercel.com y crea una cuenta gratuita
   - Recomendado: Usa tu cuenta de GitHub para facilitar los deployments

2. Si no tienes GitHub, crea una cuenta en https://github.com
   - Esto facilitará el proceso de deployment automático

---

## Paso 5: Preparar el repositorio

### Si ya tienes Git inicializado:

```bash
cd /home/maxfiorina/Escritorio/Proyect/reparaciom-pc

# Añadir archivos modificados
git add .
git commit -m "Migration to Vercel + Supabase"
```

### Si NO tienes Git inicializado:

```bash
cd /home/maxfiorina/Escritorio/Proyect/reparaciom-pc

# Inicializar repositorio
git init

# Crear .gitignore
cat > .gitignore << EOF
node_modules/
.env
.env.local
.vercel
*.log
logs/
database/*.db
backups/
.DS_Store
EOF

# Añadir archivos
git add .
git commit -m "Initial commit - Vercel + Supabase migration"
```

### Subir a GitHub:

1. Crea un nuevo repositorio en https://github.com/new
   - Nombre: `servicio-reparacion-pc` (o el que prefieras)
   - Privado o público (recomendado: privado)
   - NO inicialices con README, .gitignore o license

2. Conecta tu repositorio local con GitHub:

```bash
git remote add origin https://github.com/TU-USUARIO/servicio-reparacion-pc.git
git branch -M main
git push -u origin main
```

---

## Paso 6: Configurar reCAPTCHA

1. Ve a https://www.google.com/recaptcha/admin
2. Registra un nuevo sitio:
   - Label: `Reparación PC - Vercel`
   - reCAPTCHA type: **reCAPTCHA v3**
   - Domains:
     - `localhost` (para testing)
     - `*.vercel.app` (para production)
     - Tu dominio personalizado si tienes uno
3. Guarda el **Site Key** y **Secret Key**

---

## Paso 7: Configurar Gmail para el envío de emails

1. Ve a tu cuenta de Google: https://myaccount.google.com/security

2. Activa la verificación en dos pasos si no la tienes activada

3. Ve a **App passwords** (Contraseñas de aplicaciones)

4. Genera una nueva contraseña para la aplicación:
   - Selecciona app: Mail
   - Selecciona dispositivo: Other (Custom name)
   - Nombre: `Vercel Reparacion PC`

5. Guarda la contraseña generada (16 caracteres sin espacios)

---

## Paso 8: Deploy en Vercel

### Opción A: Deploy desde GitHub (Recomendado)

1. Ve a https://vercel.com/new

2. Importa tu repositorio de GitHub:
   - Selecciona tu repositorio `servicio-reparacion-pc`
   - Framework Preset: **Other**
   - Root Directory: `./`
   - Build Command: (dejar vacío)
   - Output Directory: (dejar vacío)

3. **Antes de hacer deploy**, configura las variables de entorno:

   Haz clic en **Environment Variables** y añade todas estas:

   ```
   NODE_ENV=production

   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

   RECAPTCHA_SITE_KEY=tu-site-key
   RECAPTCHA_SECRET_KEY=tu-secret-key
   RECAPTCHA_THRESHOLD=0.5
   BYPASS_RECAPTCHA=false

   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=tu-email@gmail.com
   EMAIL_PASS=tu-app-password-de-gmail
   EMAIL_FROM=Servicio de Reparación PC <noreply@tudominio.com>
   EMAIL_TO=tu-email@gmail.com
   EMAIL_SUBJECT_PREFIX=[Reparación PC]

   WHATSAPP_NUMBER=5491123456789
   DOMAIN=tu-proyecto.vercel.app

   RATE_LIMIT_WINDOW_MS=3600000
   RATE_LIMIT_MAX_REQUESTS=10

   DB_BACKUP_RETENTION_DAYS=30
   ```

4. Haz clic en **Deploy**

5. Espera a que el deploy termine (1-3 minutos)

### Opción B: Deploy desde CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Login en Vercel
vercel login

# Deploy
cd /home/maxfiorina/Escritorio/Proyect/reparaciom-pc
vercel

# Seguir las instrucciones en pantalla
# Configurar las variables de entorno cuando te lo pida
```

---

## Paso 9: Verificar el deployment

1. Una vez que el deploy termine, Vercel te dará una URL como:
   `https://tu-proyecto.vercel.app`

2. Prueba los siguientes endpoints:

   ```bash
   # Health check
   curl https://tu-proyecto.vercel.app/api/health

   # Contact config
   curl https://tu-proyecto.vercel.app/api/contact/config
   ```

3. Abre tu sitio en el navegador y prueba el formulario de contacto

---

## Paso 10: Configurar dominio personalizado (Opcional)

Si tienes un dominio propio (ej: `miservicio.com.ar`):

1. En Vercel, ve a **Project Settings** > **Domains**

2. Añade tu dominio personalizado

3. Vercel te dará instrucciones específicas para configurar los DNS

4. Una vez configurado, actualiza la variable de entorno `DOMAIN` en Vercel

---

## Paso 11: Configurar deployments automáticos

Con GitHub conectado, cada vez que hagas push al repositorio, Vercel automáticamente:
- Detectará los cambios
- Hará build del proyecto
- Desplegará la nueva versión
- Te notificará del resultado

Para hacer cambios:
```bash
# Hacer cambios en tu código
git add .
git commit -m "Descripción de los cambios"
git push origin main

# Vercel automáticamente desplegará los cambios
```

---

## Estructura del proyecto migrado

```
reparaciom-pc/
├── api/                          # Funciones serverless de Vercel
│   ├── health.js                 # Health check endpoint
│   ├── contact/
│   │   ├── submit.js             # Submit contact form
│   │   └── config.js             # Get contact configuration
│   └── analytics/
│       ├── visit.js              # Track page visits
│       └── whatsapp-click.js     # Track WhatsApp clicks
├── backend/
│   ├── utils/
│   │   ├── supabase-db.js        # Nueva capa de base de datos con Supabase
│   │   ├── logger.js             # (sin cambios)
│   │   └── email.js              # (sin cambios)
│   ├── middleware/               # (sin cambios)
│   └── config/                   # (sin cambios)
├── frontend/                     # Archivos estáticos (sin cambios)
├── database/
│   └── supabase-schema.sql       # Schema para PostgreSQL
├── vercel.json                   # Configuración de Vercel
├── .env.vercel.example           # Ejemplo de variables de entorno
└── package.json                  # Dependencias actualizadas
```

---

## Migrar datos existentes (si tienes datos en SQLite)

Si ya tienes contactos en tu base de datos SQLite local:

1. Instala `sqlite3` CLI:
   ```bash
   sudo apt-get install sqlite3
   ```

2. Exporta los datos:
   ```bash
   sqlite3 database/contacts.db .dump > database/export.sql
   ```

3. Convierte el formato de SQLite a PostgreSQL (manual):
   - Abre `export.sql`
   - Busca y reemplaza `INTEGER PRIMARY KEY AUTOINCREMENT` por `BIGSERIAL PRIMARY KEY`
   - Busca y reemplaza `DATETIME` por `TIMESTAMP WITH TIME ZONE`
   - Remueve las líneas que empiezan con `PRAGMA`

4. Importa en Supabase:
   - Ve al SQL Editor en Supabase
   - Copia y pega el SQL modificado
   - Ejecuta

---

## Monitoreo y Logs

### Ver logs en Vercel:

1. Ve a tu proyecto en Vercel Dashboard
2. Click en **Functions**
3. Selecciona la función que quieres ver
4. Ve los logs en tiempo real

### Ver logs en Supabase:

1. Ve a tu proyecto en Supabase
2. Click en **Logs** en el sidebar
3. Selecciona el tipo de log (Database, API, etc.)

---

## Costos

### Plan gratuito de Vercel incluye:
- 100GB bandwidth por mes
- Funciones serverless ilimitadas
- Deploy automático con Git
- SSL gratis

### Plan gratuito de Supabase incluye:
- 500MB de base de datos
- 1GB de transferencia
- 50,000 monthly active users

**Ambos son suficientes para un sitio de reparación de PC con tráfico moderado.**

---

## Troubleshooting

### Error: "Database connection failed"

1. Verifica que las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` estén correctamente configuradas en Vercel
2. Asegúrate de usar el **service_role** key, NO el **anon** key
3. Verifica que las tablas estén creadas en Supabase

### Error: "reCAPTCHA verification failed"

1. Verifica que `RECAPTCHA_SITE_KEY` y `RECAPTCHA_SECRET_KEY` estén configurados
2. Asegúrate de que el dominio de Vercel esté autorizado en Google reCAPTCHA
3. En desarrollo, puedes poner `BYPASS_RECAPTCHA=true` temporalmente

### Error: "Email service error"

1. Verifica las credenciales de Gmail
2. Asegúrate de usar una **App Password**, no tu contraseña regular
3. Verifica que la verificación en dos pasos esté activada en Google

### La página no carga archivos estáticos (CSS, JS, imágenes)

1. Verifica que los archivos estén en la carpeta `frontend/`
2. Revisa las rutas en `vercel.json`
3. Asegúrate de que los paths en tu HTML sean relativos

---

## Siguiente pasos

Una vez que tu sitio esté funcionando:

1. **Configura alertas** en Vercel para notificaciones de errores
2. **Monitorea el uso** de Supabase para asegurarte de no exceder el límite gratuito
3. **Configura backups automáticos** en Supabase (Settings > Database > Backups)
4. **Añade un dominio personalizado** si tienes uno
5. **Configura Google Analytics** para monitorear el tráfico

---

## Soporte

Si tienes problemas con la migración:

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **GitHub Issues**: Crea un issue en tu repositorio

---

## Resumen de URLs importantes

- **Dashboard de Vercel**: https://vercel.com/dashboard
- **Dashboard de Supabase**: https://app.supabase.com
- **Tu sitio en Vercel**: https://[tu-proyecto].vercel.app
- **Google reCAPTCHA**: https://www.google.com/recaptcha/admin
- **Gmail App Passwords**: https://myaccount.google.com/apppasswords

---

¡Felicitaciones! Tu sitio ahora está funcionando en la nube sin necesidad de configurar servidores locales, DNS dinámico, o hacer bridge con tu ISP.
