# Proyecto: Página Web Servicio Reparación PC

## Descripción del Proyecto
Crear una página web profesional para promocionar servicios de reparación, limpieza y mantenimiento de PC y netbooks. El sitio será hosteado localmente desde mi PC personal y promocionado mediante volantes con QR codes.

## Objetivos Principales
- Generar confianza y credibilidad profesional
- Facilitar el contacto con clientes potenciales
- Proteger contra spam, trolls y ataques
- Ser fácil de mantener y actualizar
- Funcionar perfectamente en dispositivos móviles

## Arquitectura del Sistema

### Frontend
- **Tecnología**: HTML5, CSS3, JavaScript vanilla + Bootstrap 5
- **Diseño**: Mobile-first, responsive, profesional
- **Estructura de páginas**:
 - Landing page atractiva con hero section
 - Sección "Sobre mí" con experiencia y credenciales
 - Servicios detallados con precios orientativos
 - Galería de trabajos realizados (antes/después)
 - Testimonios de clientes
 - Formulario de contacto protegido
 - Footer con información de contacto

### Backend
- **Tecnología**: Node.js + Express.js
- **Base de datos**: SQLite (simple, local)
- **Funcionalidades**:
 - API REST para formulario de contacto
 - Sistema de logs y monitoreo
 - Envío de emails automáticos
 - Rate limiting y validaciones
 - Servir archivos estáticos

### Seguridad y Protección Anti-Trolls
- **reCAPTCHA v3** en formulario de contacto
- **Rate limiting**: máximo 3 consultas por IP por hora
- **Filtros de contenido**: detección de palabras ofensivas/spam
- **Validación de emails**: verificar formato y dominio real
- **Sanitización de inputs**: prevenir inyección de código
- **Firewall de aplicación**: bloquear IPs sospechosas
- **Logs detallados**: registrar todos los intentos de contacto

### Hosting Local
- **Servidor web**: Express.js corriendo en puerto 3000
- **Proxy reverso**: nginx para manejo de SSL y static files
- **SSL**: Certificado gratuito de Let's Encrypt
- **DNS dinámico**: Configuración con DuckDNS o similar
- **Port forwarding**: Router configurado para exponer puerto 443
- **Dominio**: Registrar dominio .com.ar económico

## Estructura de Archivos Requerida
mi-servicio-pc/
├── frontend/
│   ├── index.html                 # Página principal
│   ├── css/
│   │   ├── style.css             # Estilos principales
│   │   └── responsive.css        # Media queries móviles
│   ├── js/
│   │   ├── main.js              # JavaScript principal
│   │   ├── contact-form.js      # Manejo del formulario
│   │   └── gallery.js           # Galería de imágenes
│   ├── images/
│   │   ├── hero/                # Imágenes del banner
│   │   ├── services/            # Fotos de servicios
│   │   ├── gallery/             # Antes/después trabajos
│   │   └── testimonials/        # Fotos de clientes
│   └── assets/
│       ├── favicon.ico
│       └── logo.png
├── backend/
│   ├── server.js                # Servidor Express principal
│   ├── routes/
│   │   ├── contact.js          # Rutas de contacto
│   │   └── api.js              # API endpoints
│   ├── middleware/
│   │   ├── security.js         # Middleware de seguridad
│   │   ├── rateLimiter.js      # Control de velocidad
│   │   └── validator.js        # Validaciones
│   ├── utils/
│   │   ├── email.js            # Envío de emails
│   │   ├── logger.js           # Sistema de logs
│   │   └── db.js               # Conexión base de datos
│   └── config/
│       ├── database.js         # Configuración DB
│       └── security.js         # Config seguridad
├── database/
│   ├── schema.sql              # Estructura de tablas
│   └── seed.sql                # Datos de prueba
├── scripts/
│   ├── install.sh              # Instalación Linux/Mac
│   ├── install.bat             # Instalación Windows
│   ├── start.sh                # Iniciar servidor Linux/Mac
│   ├── start.bat               # Iniciar servidor Windows
│   ├── backup.sh               # Script de backup
│   └── ssl-setup.sh            # Configuración SSL
├── config/
│   ├── nginx.conf              # Configuración nginx
│   ├── .env.example            # Variables de entorno ejemplo
│   └── router-setup.md         # Guía configuración router
├── docs/
│   ├── SETUP.md                # Guía de instalación completa
│   ├── DEPLOYMENT.md           # Guía de deployment
│   ├── SECURITY.md             # Guía de seguridad
│   └── MAINTENANCE.md          # Mantenimiento y updates
├── package.json                # Dependencias Node.js
├── .gitignore                  # Archivos a ignorar
├── .env                        # Variables de entorno (no versionar)
└── README.md                   # Documentación principal

## Contenido y Secciones del Sitio

### Página Principal (index.html)

**Hero Section:**
- Título llamativo: "Reparación y Limpieza de PC Profesional"
- Subtítulo con ubicación y años de experiencia
- Botón CTA principal: "Solicitar Presupuesto"
- Imagen de portada profesional

**Sección Servicios:**
- Limpieza profunda de PC y notebooks
- Reparación de hardware (memorias, discos, fuentes)
- Optimización y limpieza de software
- Instalación de sistemas operativos
- Recuperación de datos
- Precios orientativos por servicio

**Sección "Sobre Mí":**
- Experiencia en años
- Certificaciones o cursos relevantes
- Área de cobertura geográfica
- Garantía ofrecida en trabajos

**Galería de Trabajos:**
- Fotos antes/después de limpiezas
- Casos de reparaciones exitosas
- Equipos trabajados (variedad de marcas/modelos)

**Testimonios:**
- Mínimo 3-5 testimonios reales
- Nombres y fotos (con permiso) o iniciales
- Calificación con estrellas

**Formulario de Contacto:**
- Nombre completo (requerido)
- Email válido (requerido)
- Teléfono/WhatsApp (requerido)
- Tipo de equipo (dropdown)
- Descripción del problema (textarea)
- reCAPTCHA obligatorio
- Checkbox términos y condiciones

**Footer:**
- Métodos de contacto (sin exponer datos directos)
- Horarios de atención
- Área de cobertura
- Enlaces a redes sociales
- Copyright

## Configuración de Seguridad

### Variables de Entorno (.env)
```env
# Servidor
PORT=3000
NODE_ENV=production
DOMAIN=tu-dominio.com.ar

# Base de datos
DB_PATH=./database/contacts.db

# Email (usando Gmail SMTP)
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password
EMAIL_TO=tu-email@gmail.com

# reCAPTCHA
RECAPTCHA_SITE_KEY=tu-site-key
RECAPTCHA_SECRET_KEY=tu-secret-key

# Seguridad
JWT_SECRET=tu-jwt-secret-muy-seguro
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=3

# WhatsApp Business
WHATSAPP_NUMBER=5491112345678
Medidas de Seguridad Implementadas

Validación de inputs: Sanitizar todos los campos del formulario
Rate limiting: Máximo 3 consultas por IP por hora
reCAPTCHA v3: Verificación automática de bots
Filtros de spam: Lista de palabras prohibidas
Validación de email: Verificar formato y existencia del dominio
Logs detallados: Registrar IP, timestamp, contenido de consultas
Firewall de aplicación: Bloquear IPs con comportamiento sospechoso
HTTPS obligatorio: Redirects automáticos de HTTP a HTTPS
Headers de seguridad: HSTS, X-Frame-Options, etc.
Backup automático: Copia de seguridad diaria de base de datos

Integraciones Requeridas
WhatsApp Business

Botón flotante de WhatsApp con mensaje predefinido
Link directo desde formulario de contacto
Mensaje automático: "Hola! Vi tu página web y necesito ayuda con mi [tipo_equipo]"

Email Automático

Confirmación automática al cliente
Notificación al técnico con detalles
Template HTML profesional
Información de próximos pasos

Analytics y Monitoreo

Google Analytics 4 (opcional)
Sistema propio de métricas básicas
Logs de acceso y errores
Monitor de uptime básico

Scripts de Instalación y Deployment
install.sh (Linux/Mac)
bash#!/bin/bash
# Instalar dependencias
# Configurar base de datos
# Generar certificados SSL
# Configurar nginx
# Crear servicios systemd
install.bat (Windows)
batch@echo off
REM Instalar dependencias
REM Configurar base de datos  
REM Configurar servidor web
REM Crear servicios Windows
start.sh (Iniciar servidor)
bash#!/bin/bash
# Verificar certificados SSL
# Iniciar base de datos
# Iniciar servidor Node.js
# Iniciar nginx
# Mostrar estado
Documentación Requerida
README.md

Descripción del proyecto
Requisitos del sistema
Instalación paso a paso
Configuración inicial
Uso básico
Troubleshooting común

SETUP.md

Configuración detallada del router
Registro de dominio
Configuración DNS dinámico
Certificados SSL
Configuración de email

DEPLOYMENT.md

Proceso completo de deployment
Verificaciones post-instalación
Configuración de monitoring
Procedimientos de backup
Actualizaciones del sistema

SECURITY.md

Checklist de seguridad
Configuración de firewall
Monitoreo de logs
Respuesta a incidentes
Actualizaciones de seguridad

Criterios de Éxito

 Página web funcional y profesional
 Formulario de contacto seguro y funcional
 Hosting local configurado con SSL
 Protección efectiva contra spam/trolls
 Diseño responsive perfecto en móviles
 Documentación completa para mantenimiento
 Scripts de instalación funcionando
 Sistema de backup automático
 Integración WhatsApp Business
 Logs y monitoreo operativo

Consideraciones Adicionales

El sitio debe cargar rápido (<3 segundos)
Todas las imágenes optimizadas para web
SEO básico implementado (meta tags, estructura HTML)
Accesibilidad web básica (alt texts, contraste, navegación por teclado)
Compatibilidad con navegadores principales
Fácil actualización de contenido sin conocimientos técnicos

Presupuesto de Hosting

Dominio .com.ar: ~$500-800 pesos/año
Certificado SSL: Gratis (Let's Encrypt)
Hosting: Gratis (tu propia PC)
Total anual aproximado: $800 pesos

Próximos Pasos Después de la Implementación

Testear completamente en múltiples dispositivos
Configurar Google My Business
Crear perfiles en redes sociales
Diseñar e imprimir volantes con QR
Implementar estrategia de testimonios
Configurar métricas y analytics
Establecer rutina de mantenimiento semanal
