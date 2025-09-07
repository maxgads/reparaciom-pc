# PC Service Pro - Frontend

## 🚀 Proyecto Completo - Página Web de Reparación PC

Sitio web profesional y optimizado para servicios de reparación, limpieza y mantenimiento de PC y notebooks.

## ✨ Características Principales

### 🎨 Diseño y UI/UX
- **Diseño Responsive**: Mobile-first con Bootstrap 5
- **Interfaz Moderna**: Diseño profesional que genera confianza
- **Animaciones Smooth**: Transiciones y efectos visuales suaves
- **Tema Coherente**: Paleta de colores profesional (azul/amarillo)

### 📱 Tecnologías Implementadas
- **HTML5 Semántico**: Estructura accesible y SEO-friendly
- **CSS3 Moderno**: Custom properties, flexbox, grid
- **JavaScript Vanilla**: Sin dependencias externas pesadas
- **Bootstrap 5**: Framework CSS responsive
- **PWA Ready**: Service Worker + Manifest

### 🔧 Funcionalidades

#### Hero Section
- Estadísticas animadas (500+ PCs reparadas)
- Call-to-action prominente
- Diseño atractivo con gradientes

#### Servicios
- 6 servicios principales con precios
- Cards interactivas con hover effects
- Iconografía profesional

#### Galería Interactiva
- Filtros por categoría (limpieza, reparación, upgrades)
- Modal con navegación por teclado
- Lazy loading de imágenes
- Efectos hover suaves

#### Formulario de Contacto
- Validación completa client-side
- Integración reCAPTCHA v3
- Rate limiting (3 intentos/hora)
- Sanitización de datos
- Integración EmailJS para envío sin backend

#### WhatsApp Business
- Botón flotante responsive
- Mensaje predefinido personalizado
- Link directo desde formulario

### 🚀 Performance y Optimización

#### Carga Rápida (<3s)
- **Critical CSS**: Estilos críticos inline
- **Lazy Loading**: Imágenes cargadas bajo demanda  
- **Resource Hints**: Preload, prefetch, preconnect
- **Compresión**: Assets optimizados
- **Service Worker**: Caché inteligente

#### SEO y Accesibilidad
- **Structured Data**: Schema.org para local business
- **Meta Tags**: Open Graph, Twitter Cards
- **Semántica HTML5**: Headers, sections, nav
- **ARIA Labels**: Accesibilidad completa
- **Skip Links**: Navegación por teclado

#### PWA (Progressive Web App)
- **Installable**: Manifest.json completo
- **Offline Support**: Service Worker con estrategias de caché
- **App-like**: Experiencia nativa en móvil
- **Push Notifications**: Preparado para notificaciones

## 📁 Estructura de Archivos

```
frontend/
├── index.html              # Página principal completa
├── css/
│   ├── style.css          # Estilos principales
│   └── responsive.css     # Media queries responsivas
├── js/
│   ├── main.js           # JavaScript principal
│   ├── gallery.js        # Funcionalidad galería
│   └── contact-form.js   # Validación formulario
├── images/
│   ├── hero/             # Imágenes sección principal
│   ├── gallery/          # Trabajos realizados
│   ├── services/         # Imágenes servicios
│   └── testimonials/     # Avatares clientes
├── assets/
│   ├── manifest.json     # PWA manifest
│   ├── favicon.ico       # Icono del sitio
│   └── apple-touch-icon.png
├── sw.js                 # Service Worker PWA
└── generate-placeholders.html # Generador imágenes
```

## 🛠️ Configuración e Instalación

### Requisitos Previos
- Navegador web moderno
- Servidor web local (opcional para desarrollo)

### Instalación Rápida
```bash
# Clonar/descargar archivos
cd frontend/

# Servir localmente (Python)
python -m http.server 8000

# O con Node.js
npx serve .

# Abrir en navegador
http://localhost:8000
```

### Configuración EmailJS
1. Crear cuenta en [EmailJS](https://emailjs.com)
2. Configurar servicio de email
3. Editar `js/contact-form.js`:
```javascript
const formConfig = {
    emailJsServiceId: 'TU_SERVICE_ID',
    emailJsTemplateId: 'TU_TEMPLATE_ID',
    emailJsUserId: 'TU_USER_ID'
};
```

### Configuración reCAPTCHA
1. Obtener keys en [Google reCAPTCHA](https://recaptcha.google.com)
2. Reemplazar site key en `index.html`:
```html
<div class="g-recaptcha" data-sitekey="TU_SITE_KEY"></div>
```

### WhatsApp Business
Editar número en `index.html` y JavaScript:
```html
<a href="https://wa.me/TU_NUMERO">
```

## 📊 Performance Optimizations

### Métricas Objetivo
- **First Contentful Paint**: <1.5s
- **Largest Contentful Paint**: <2.5s
- **Time to Interactive**: <3s
- **Cumulative Layout Shift**: <0.1

### Optimizaciones Implementadas
- ✅ Critical CSS inline
- ✅ Lazy loading imágenes
- ✅ Service Worker caché
- ✅ Resource hints
- ✅ Minificación assets
- ✅ Compresión gzip ready

## 🔒 Seguridad

### Medidas Implementadas
- **Rate Limiting**: 3 intentos por hora por IP
- **Input Sanitization**: Validación client-side
- **reCAPTCHA v3**: Protección anti-spam
- **Content Security Policy**: Headers seguros
- **Form Validation**: Múltiples capas validación

## 📱 Responsive Design

### Breakpoints
- **XS**: <576px (móviles)
- **SM**: 576px+ (móviles landscape)
- **MD**: 768px+ (tablets)
- **LG**: 992px+ (desktop)
- **XL**: 1200px+ (pantallas grandes)

### Testing
- ✅ Chrome DevTools
- ✅ Firefox Responsive Design
- ✅ Real device testing
- ✅ Lighthouse audits

## 🚀 Deployment

### Opciones de Hosting
1. **GitHub Pages** (gratis)
2. **Netlify** (gratis con dominio custom)
3. **Vercel** (gratis con excelente performance)
4. **Hosting tradicional** (cPanel, FTP)

### Preparación para Producción
```bash
# Optimizar imágenes
imagemin src/images/* --out-dir=dist/images

# Minificar CSS/JS (opcional)
# Los archivos están optimizados pero se puede minificar más

# Test performance
lighthouse --view http://localhost:8000
```

## 🐛 Troubleshooting

### Problemas Comunes
1. **Imágenes no cargan**: Verificar rutas relativas
2. **Formulario no envía**: Configurar EmailJS
3. **PWA no instala**: Verificar manifest.json
4. **Mobile no responsive**: Revisar viewport meta

### Debug Mode
```javascript
// En consola del navegador
localStorage.setItem('debug', 'true');
```

## 📈 Analytics y Métricas

### Google Analytics 4
```html
<!-- Agregar en <head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
```

### Métricas Custom
- Envíos de formulario
- Clicks en WhatsApp
- Filtros de galería utilizados
- Tiempo en página

## 🎯 Próximos Features

### Roadmap
- [ ] Chat bot integrado
- [ ] Sistema de testimonios dinámico
- [ ] Multi-idioma (EN/ES)
- [ ] Dark mode toggle
- [ ] Geolocalización servicios
- [ ] Calculadora de precios
- [ ] Sistema de citas online

## 🤝 Contribución

### Guías de Estilo
- **CSS**: BEM methodology
- **JavaScript**: ES6+ features
- **HTML**: Semantic markup
- **Commits**: Conventional commits

## 📄 Licencia

Este proyecto está optimizado para uso comercial de servicios de reparación PC.

---

## 💡 Tips de Uso

### Para el Cliente Final
1. **Personalizar contenido**: Editar textos en `index.html`
2. **Cambiar colores**: Modificar CSS custom properties
3. **Actualizar precios**: Editar sección servicios
4. **Agregar trabajos**: Añadir imágenes en galería
5. **Contact info**: Actualizar datos de contacto

### Mantenimiento
- Revisar formulario mensualmente
- Actualizar testimonios regularmente  
- Monitorear performance con Lighthouse
- Backup archivos antes de cambios

### Marketing Digital
- QR codes apuntan al sitio
- Optimizado para Google My Business
- Preparado para Google Ads
- Schema markup para SEO local

---

**¡Sitio web profesional listo para generar clientes y hacer crecer tu negocio de reparación PC! 🚀**