# Instrucciones para completar el Panel Admin - Reparaciones La Plata

## Contexto del Proyecto
- Sitio web de reparación de PC en La Plata completamente personalizado
- Backend Node.js/Express con SQLite ya implementado y funcionando
- Frontend con admin panel que usa datos falsos (mock data)
- Todas las APIs del backend están listas pero no conectadas al frontend

## PROBLEMA PRINCIPAL
El panel admin (/admin) usa datos falsos hardcodeados en lugar de conectarse a las APIs reales del backend que ya existen y funcionan.

## APIs Backend Disponibles (YA FUNCIONAN):
- `/api/db-stats` - Estadísticas reales de base de datos
- `/api/info` - Información del sistema 
- `/api/security` - Estado de seguridad
- Autenticación: header `x-admin-key` con `ADMIN_SECRET_KEY`

## TAREAS A COMPLETAR:

### 1. Reemplazar datos mock con APIs reales
**Archivo**: `/home/maxi-fiorina/Escritorio/REPARACIONEs/frontend/admin.html`
- Línea 228-246: función `loadDashboardData()` usa `Math.random()`
- Línea 298-342: función `loadContactsTable()` usa array hardcodeado
- CAMBIAR por llamadas fetch() a `/api/db-stats`

### 2. Implementar autenticación real con backend
- Cambiar login hardcodeado (admin/repara2024) por validación con backend
- Guardar admin key para usar en headers de API calls
- Usar header `x-admin-key: ${adminKey}` en todas las requests

### 3. Conectar estadísticas reales
Reemplazar estos valores fake:
```javascript
totalVisits: Math.floor(Math.random() * 500) + 100,
totalContacts: Math.floor(Math.random() * 25) + 5,
```
Con datos reales de `/api/db-stats`:
```javascript
stats.contacts.total  // total contacts
stats.security.totalEvents  // total visits
```

### 4. Mostrar contactos reales de base de datos
- Conectar tabla a datos reales de contactos
- Mostrar: nombre, email, teléfono, equipo, estado, fecha
- Implementar acciones: cambiar estado contacto

### 5. Agregar tracking de WhatsApp
- Crear endpoint para trackear clicks de WhatsApp
- Mostrar estadística real de clicks WhatsApp
- Integrar en frontend

## ARCHIVOS PRINCIPALES:
- **Frontend Admin**: `/home/maxi-fiorina/Escritorio/REPARACIONEs/frontend/admin.html`
- **Backend APIs**: `/home/maxi-fiorina/Escritorio/REPARACIONEs/backend/routes/api.js`
- **Backend Contacts**: `/home/maxi-fiorina/Escritorio/REPARACIONEs/backend/routes/contact.js`
- **Servidor**: `/home/maxi-fiorina/Escritorio/REPARACIONEs/backend/server.js`

## ESTRUCTURA API RESPONSE ACTUAL:
```json
{
  "success": true,
  "stats": {
    "contacts": {
      "total": 15,
      "byStatus": {"pending": 5, "contacted": 7, "resolved": 3},
      "byEquipmentType": {"PC": 8, "Notebook": 7}
    },
    "security": {
      "totalEvents": 234,
      "eventsByType": {"contact_attempt": 15, "admin_page_accessed": 8}
    }
  }
}
```

## COMANDO PARA TESTEAR:
```bash
cd /home/maxi-fiorina/Escritorio/REPARACIONEs/backend
npm run dev
```
- Frontend: http://localhost:3000
- Admin: http://localhost:3000/admin  
- API Stats: http://localhost:3000/api/db-stats

## OBJETIVO FINAL:
Panel admin completamente funcional con:
✅ Estadísticas reales de base de datos
✅ Autenticación segura con backend
✅ Gestión de contactos reales
✅ Tracking de WhatsApp clicks
✅ Actualizaciones en tiempo real

**STATUS ACTUAL**: Todo el backend está listo, solo falta conectar el frontend admin a las APIs existentes.