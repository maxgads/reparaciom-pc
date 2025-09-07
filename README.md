# 🔧 Servicio de Reparación PC - Backend & Seguridad

Sistema completo de backend y seguridad para página web de servicio de reparación de PC y notebooks. Incluye formulario de contacto seguro, protección anti-spam, sistema de logs avanzado y backup automático.

## 🚀 Características Principales

### 🛡️ Seguridad Avanzada
- **Rate Limiting**: Máximo 3 consultas por IP por hora
- **reCAPTCHA v3**: Verificación automática de bots
- **Anti-Spam**: Filtros de palabras ofensivas y patrones sospechosos
- **Validación exhaustiva**: Sanitización de todos los inputs
- **Bloqueo de IPs**: Automático para actividad sospechosa
- **Headers de seguridad**: CORS, Helmet, HSTS
- **Logs detallados**: Monitoreo completo de actividad

### 📧 Sistema de Emails
- **Confirmación automática**: Email al cliente
- **Notificación técnica**: Alerta inmediata con detalles
- **Templates HTML**: Profesionales y responsivos
- **Integración WhatsApp**: Enlaces directos

### 💾 Base de Datos
- **SQLite**: Base local, simple y eficiente
- **Backup automático**: Compresión y encriptación
- **Retención configurable**: Limpieza automática
- **Esquema completo**: Contactos, logs de seguridad, estadísticas

### 📊 Monitoreo
- **Logs rotativos**: Winston con archivos diarios
- **Métricas de seguridad**: Estadísticas en tiempo real
- **Health checks**: Estado del sistema
- **API de administración**: Estadísticas y control

## 📁 Estructura del Proyecto

```
backend/
├── server.js                  # Servidor Express principal
├── routes/
│   ├── contact.js            # API formulario de contacto
│   └── api.js                # Endpoints generales
├── middleware/
│   ├── security.js           # Headers y análisis de seguridad
│   ├── rateLimiter.js        # Control de velocidad avanzado
│   └── validator.js          # Validación y anti-spam
├── utils/
│   ├── email.js              # Servicio de emails
│   ├── logger.js             # Sistema de logs
│   └── db.js                 # Utilidades de base de datos
└── config/
    ├── database.js           # Configuración DB
    ├── security.js           # Configuración de seguridad
    └── spam-keywords.txt     # Lista de palabras prohibidas

database/
├── schema.sql                # Estructura de tablas
└── seed.sql                  # Datos de prueba

scripts/
├── backup.js                 # Sistema de backup
└── setup.js                  # Utilidad de instalación

logs/                         # Logs del sistema (auto-creado)
backups/                      # Backups de BD (auto-creado)
```

## ⚙️ Instalación y Configuración

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

Copiar y editar el archivo `.env`:

```env
# Servidor
PORT=3000
NODE_ENV=production
DOMAIN=tu-dominio.com.ar

# Base de datos
DB_PATH=./database/contacts.db

# Email (Gmail)
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password
EMAIL_TO=tu-email@gmail.com

# reCAPTCHA
RECAPTCHA_SITE_KEY=tu-site-key
RECAPTCHA_SECRET_KEY=tu-secret-key

# Seguridad
JWT_SECRET=tu-jwt-secret-muy-largo-y-seguro
RATE_LIMIT_MAX_REQUESTS=3

# WhatsApp
WHATSAPP_NUMBER=5491112345678

# Backup
BACKUP_ENABLED=true
BACKUP_ENCRYPT=true
BACKUP_ENCRYPTION_KEY=tu-clave-de-encriptacion
```

### 3. Configurar Base de Datos

```bash
# Configurar BD con datos de prueba
node scripts/setup.js --seed

# Solo configurar BD (sin datos)
node scripts/setup.js
```

### 4. Verificar Configuración

```bash
# Verificar sistema
node scripts/setup.js --check

# Ver estado del proyecto
node scripts/setup.js --status
```

## 🏃‍♂️ Ejecución

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

### Verificar Estado
```bash
curl http://localhost:3000/health
```

## 📊 API Endpoints

### Formulario de Contacto
- `POST /api/contact/submit` - Enviar consulta
- `GET /api/contact/config` - Configuración del formulario
- `GET /api/contact/health` - Estado del sistema de contacto

### Sistema General
- `GET /api/health` - Estado del servidor
- `GET /api/security` - Estado de seguridad
- `GET /api/version` - Información de versión

### Administración (requiere autenticación)
- `GET /api/info` - Información del sistema
- `GET /api/db-stats` - Estadísticas de la BD
- `POST /api/cleanup` - Limpiar registros antiguos

## 🔐 Sistema de Seguridad

### Rate Limiting
- **Contacto**: 3 requests/hora por IP
- **Global**: 100 requests/minuto por IP
- **Bloqueo automático**: IPs con múltiples violaciones

### Validación de Inputs
- **Sanitización HTML**: Prevención XSS
- **Validación de email**: Formato y dominio
- **Filtro de profanidad**: Palabras ofensivas
- **Detección de spam**: Patrones sospechosos
- **Longitud de mensajes**: Límites configurables

### reCAPTCHA v3
- **Score threshold**: 0.5 (configurable)
- **Acción específica**: contact_form
- **Verificación server-side**: Token validation

### Logging de Seguridad
- **Intentos de contacto**: Todos los envíos
- **Violaciones de rate limit**: IPs bloqueadas
- **Spam detectado**: Contenido filtrado
- **Actividad sospechosa**: Patrones anómalos

## 💾 Sistema de Backup

### Crear Backup Manual
```bash
node scripts/backup.js create backup-manual-2024
```

### Restaurar Backup
```bash
node scripts/backup.js restore backup-manual-2024
```

### Listar Backups
```bash
node scripts/backup.js list
```

### Limpiar Backups Antiguos
```bash
node scripts/backup.js cleanup
```

### Backup Automático
- **Programado**: Cada 6 horas
- **Compresión**: gzip nivel 6
- **Encriptación**: AES-256-GCM (opcional)
- **Retención**: 30 días (configurable)

## 📧 Sistema de Emails

### Configuración Gmail
1. Habilitar 2FA en Gmail
2. Generar App Password
3. Usar App Password en EMAIL_PASS

### Templates Incluidos
- **Confirmación cliente**: Email profesional con próximos pasos
- **Notificación técnico**: Alerta con todos los detalles
- **Diseño responsivo**: Funciona en móviles y desktop

## 🔧 Comandos Útiles

```bash
# Desarrollo
npm run dev                    # Servidor con auto-reload
npm run logs                   # Ver logs en tiempo real

# Producción  
npm start                      # Iniciar servidor
npm run backup                 # Crear backup manual
npm run security-check         # Verificar vulnerabilidades

# Base de datos
npm run setup-db               # Configurar BD
npm run seed-db                # Cargar datos de prueba

# Monitoreo
npm run monitor                # Monitor del sistema
curl localhost:3000/health     # Health check
```

## 🛠️ Personalización

### Agregar Palabras de Spam
Editar `backend/config/spam-keywords.txt`:
```
nueva-palabra-spam
patron-sospechoso
oferta-falsa
```

### Configurar Tipos de Equipo
En `backend/routes/contact.js`, modificar el array:
```javascript
equipmentTypes: ['PC', 'Notebook', 'Consola', 'Tablet', 'Otro']
```

### Ajustar Rate Limiting
En `.env`:
```env
RATE_LIMIT_MAX_REQUESTS=5
RATE_LIMIT_WINDOW_MS=1800000  # 30 minutos
```

## 🚨 Resolución de Problemas

### El servidor no inicia
```bash
# Verificar configuración
node scripts/setup.js --check

# Ver logs de error
tail -f logs/error-*.log
```

### Emails no se envían
```bash
# Probar configuración de email
curl -X POST http://localhost:3000/api/test-email \
  -H "x-admin-key: tu-admin-key"
```

### Base de datos corrupta
```bash
# Restaurar desde backup
node scripts/backup.js list
node scripts/backup.js restore nombre-del-backup
```

### Rate limit muy restrictivo
```bash
# Temporalmente en .env
RATE_LIMIT_MAX_REQUESTS=10

# O deshabilitar para IP específica (whitelist)
# Editar backend/config/security.js
```

## 📈 Monitoreo y Métricas

### Logs Disponibles
- `logs/combined-*.log` - Todos los eventos
- `logs/error-*.log` - Solo errores  
- `logs/security-*.log` - Eventos de seguridad

### Métricas del Sistema
```bash
curl http://localhost:3000/api/security
curl http://localhost:3000/api/db-stats
```

### Alertas Recomendadas
- **Disk space**: < 1GB libre
- **Failed logins**: > 10/hora
- **Memory usage**: > 90%
- **Response time**: > 5 segundos

## 🔄 Actualizaciones

### Actualizar Dependencias
```bash
npm audit                      # Verificar vulnerabilidades
npm update                     # Actualizar packages
npm audit fix                  # Corregir vulnerabilidades
```

### Backup Antes de Actualizar
```bash
node scripts/backup.js create pre-update-$(date +%Y%m%d)
```

## 📞 Soporte

Para problemas o consultas:

1. **Revisar logs**: `logs/error-*.log`
2. **Verificar configuración**: `node scripts/setup.js --check`  
3. **Health check**: `curl localhost:3000/health`
4. **Backup de seguridad**: `node scripts/backup.js create`

---

## 📄 Licencia

ISC License - Ver archivo LICENSE para detalles.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork del proyecto
2. Crear branch para feature
3. Commit de cambios
4. Push al branch
5. Crear Pull Request

---

**⚠️ IMPORTANTE**: Este sistema maneja datos personales. Asegúrate de cumplir con las regulaciones de privacidad aplicables en tu jurisdicción.

**🔒 SEGURIDAD**: Nunca expongas las variables de entorno en repositorios públicos. Usa archivos `.env` locales y secrets para producción.