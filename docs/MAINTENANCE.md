# 🔧 Guía Completa de Mantenimiento

## 📋 Índice
1. [Mantenimiento Diario](#mantenimiento-diario)
2. [Mantenimiento Semanal](#mantenimiento-semanal)
3. [Mantenimiento Mensual](#mantenimiento-mensual)
4. [Actualizaciones del Sistema](#actualizaciones-del-sistema)
5. [Monitoreo y Alertas](#monitoreo-y-alertas)
6. [Optimización de Performance](#optimización-de-performance)
7. [Resolución de Problemas](#resolución-de-problemas)

---

## 📅 Mantenimiento Diario

### 🔄 Tareas Automáticas

Estas tareas están automatizadas pero deben verificarse:

```bash
# Script: scripts/daily-maintenance.sh
#!/bin/bash

echo "=== MANTENIMIENTO DIARIO AUTOMÁTICO ==="
echo "Fecha: $(date)"
echo

# 1. Verificar servicios críticos
echo "1. Verificando servicios..."
services=(reparacion-pc nginx)
for service in "${services[@]}"; do
    if systemctl is-active --quiet $service; then
        echo "   ✅ $service: FUNCIONANDO"
    else
        echo "   ❌ $service: PARADO - Intentando reiniciar..."
        systemctl restart $service
        sleep 3
        if systemctl is-active --quiet $service; then
            echo "   ✅ $service: REINICIADO EXITOSAMENTE"
        else
            echo "   ❌ $service: FALLO AL REINICIAR"
        fi
    fi
done

# 2. Verificar espacio en disco
echo "2. Verificando espacio en disco..."
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 80 ]; then
    echo "   ✅ Espacio en disco: OK ($DISK_USAGE%)"
else
    echo "   ⚠️  Espacio en disco: ALTO ($DISK_USAGE%) - Limpiando..."
    
    # Limpiar logs antiguos
    find logs/ -name "*.log" -mtime +7 -delete
    
    # Limpiar backups antiguos (mantener últimos 15)
    cd backups && ls -1t backup_*.tar.gz | tail -n +16 | xargs rm -f 2>/dev/null; cd -
    
    # Limpiar cache de npm
    npm cache clean --force >/dev/null 2>&1
    
    NEW_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    echo "   📊 Nuevo uso de disco: $NEW_USAGE%"
fi

# 3. Verificar memoria
echo "3. Verificando memoria..."
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $MEM_USAGE -lt 85 ]; then
    echo "   ✅ Memoria: OK ($MEM_USAGE%)"
else
    echo "   ⚠️  Memoria alta: $MEM_USAGE% - Considerando reinicio de servicios"
fi

# 4. Health check de la aplicación
echo "4. Health check de aplicación..."
if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "   ✅ Health check: OK"
else
    echo "   ❌ Health check: FALLÓ"
fi

# 5. Verificar SSL
echo "5. Verificando SSL..."
source .env 2>/dev/null
if [ ! -z "$DOMAIN" ]; then
    if openssl x509 -checkend 2592000 -noout -in "/etc/letsencrypt/live/$DOMAIN/cert.pem" 2>/dev/null; then
        echo "   ✅ SSL: OK (>30 días restantes)"
    else
        echo "   ⚠️  SSL: Expira pronto - Renovando..."
        certbot renew --quiet --nginx
    fi
fi

# 6. Verificar DNS dinámico
echo "6. Actualizando DNS dinámico..."
if [ -f "scripts/update-duckdns.sh" ]; then
    ./scripts/update-duckdns.sh
    echo "   ✅ DNS actualizado"
fi

# 7. Log del mantenimiento
echo "$(date '+%Y-%m-%d %H:%M:%S') - Mantenimiento diario completado" >> logs/maintenance.log

echo
echo "✅ Mantenimiento diario completado"
```

### 📋 Checklist Manual Diario

Verificar cada mañana:

- [ ] **Servicios**: `systemctl status reparacion-pc nginx`
- [ ] **Logs de errores**: `tail -50 logs/app.log | grep -i error`
- [ ] **Consultas recibidas**: `sqlite3 database/contacts.db "SELECT COUNT(*) FROM contacts WHERE date(created_at) = date('now');"`
- [ ] **SSL válido**: `./scripts/ssl-check.sh`
- [ ] **Backup nocturno**: `ls -la backups/ | tail -5`

```bash
# Script rápido de verificación diaria
./scripts/daily-check.sh
```

---

## 📆 Mantenimiento Semanal

### 🔄 Tareas Programadas

```bash
# Script: scripts/weekly-maintenance.sh
#!/bin/bash

echo "=== MANTENIMIENTO SEMANAL ==="
echo "Fecha: $(date)"
echo

# 1. Backup completo del sistema
echo "1. Realizando backup completo..."
./scripts/backup.sh

# 2. Actualizar dependencias de Node.js
echo "2. Verificando actualizaciones de dependencias..."
npm outdated
echo "¿Hay actualizaciones críticas de seguridad?"
npm audit

# 3. Análisis de logs de la semana
echo "3. Analizando logs de la semana..."
STATS_DIR="stats/week_$(date +%Y%W)"
mkdir -p "$STATS_DIR"

# Estadísticas de nginx
if [ -f "/var/log/nginx/access.log" ]; then
    echo "   Generando estadísticas de acceso..."
    
    # Top 10 IPs de la semana
    awk -v date="$(date -d '7 days ago' '+%d/%b/%Y')" '$4 > "["date {print $1}' /var/log/nginx/access.log | \
    sort | uniq -c | sort -nr | head -10 > "$STATS_DIR/top_ips.txt"
    
    # Páginas más visitadas
    awk '{print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -10 > "$STATS_DIR/top_pages.txt"
    
    # Errores 4xx y 5xx
    grep -E " (4[0-9][0-9]|5[0-9][0-9]) " /var/log/nginx/access.log > "$STATS_DIR/errors.log"
    
    echo "   📊 Estadísticas guardadas en: $STATS_DIR"
fi

# 4. Análisis de base de datos
echo "4. Analizando base de datos..."
if [ -f "database/contacts.db" ]; then
    sqlite3 database/contacts.db << 'EOF' > "$STATS_DIR/db_stats.txt"
.header on
.mode column
SELECT 'Total contactos' as Metric, COUNT(*) as Value FROM contacts;
SELECT 'Contactos esta semana' as Metric, COUNT(*) as Value FROM contacts WHERE created_at >= datetime('now', '-7 days');
SELECT 'IPs bloqueadas' as Metric, COUNT(*) as Value FROM blocked_ips;
EOF
    
    echo "   📊 Estadísticas de BD guardadas"
fi

# 5. Verificar integridad de archivos críticos
echo "5. Verificando integridad de archivos..."
CRITICAL_FILES=(".env" "package.json" "database/contacts.db")
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        md5sum "$file" >> "$STATS_DIR/file_checksums.txt"
    fi
done

# 6. Limpiar archivos temporales
echo "6. Limpiando archivos temporales..."
# Limpiar logs rotativos antiguos
find /var/log/nginx/ -name "*.log.*" -mtime +14 -delete 2>/dev/null
find logs/ -name "*.log.*" -mtime +14 -delete 2>/dev/null

# 7. Verificar fail2ban
echo "7. Verificando fail2ban..."
if command -v fail2ban-client >/dev/null 2>&1; then
    sudo fail2ban-client status > "$STATS_DIR/fail2ban_status.txt"
    echo "   📊 Estado de fail2ban guardado"
fi

# 8. Reporte semanal
cat > "$STATS_DIR/weekly_report.txt" << EOF
REPORTE SEMANAL DE MANTENIMIENTO
===============================
Fecha: $(date)
Semana: $(date +%Y-W%W)

ESTADO GENERAL:
- Uptime del servidor: $(uptime -p)
- Uso de disco: $(df -h / | tail -1 | awk '{print $5}')
- Uso de memoria promedio: Revisar logs
- Consultas recibidas esta semana: $(sqlite3 database/contacts.db "SELECT COUNT(*) FROM contacts WHERE created_at >= datetime('now', '-7 days');" 2>/dev/null || echo "N/A")

ARCHIVOS GENERADOS:
- top_ips.txt: Top IPs visitantes
- top_pages.txt: Páginas más visitadas  
- errors.log: Errores HTTP
- db_stats.txt: Estadísticas de base de datos
- file_checksums.txt: Checksums de archivos críticos
- fail2ban_status.txt: Estado del firewall

ACCIONES REALIZADAS:
✅ Backup completo creado
✅ Dependencias verificadas
✅ Logs analizados
✅ Integridad verificada
✅ Limpieza de temporales
✅ Estado de seguridad verificado

PRÓXIMAS ACCIONES RECOMENDADAS:
- Revisar estadísticas de tráfico
- Verificar performance de la aplicación
- Considerar optimizaciones si es necesario
EOF

echo "📊 Reporte semanal generado: $STATS_DIR/weekly_report.txt"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Mantenimiento semanal completado" >> logs/maintenance.log

echo "✅ Mantenimiento semanal completado"
```

### 📋 Checklist Manual Semanal

- [ ] **Revisar estadísticas de tráfico**: `ls -la stats/`
- [ ] **Actualizar dependencias si es necesario**: `npm update`
- [ ] **Verificar performance**: `./scripts/performance-check.sh`
- [ ] **Revisar logs de fail2ban**: `sudo fail2ban-client status`
- [ ] **Test de recovery**: Probar restaurar un backup
- [ ] **Revisar configuración DNS**: `./scripts/dns-check.sh`

---

## 📊 Mantenimiento Mensual

### 🔄 Tareas Completas

```bash
# Script: scripts/monthly-maintenance.sh
#!/bin/bash

echo "=== MANTENIMIENTO MENSUAL COMPLETO ==="
echo "Fecha: $(date)"
echo

# 1. Auditoría completa de seguridad
echo "1. Ejecutando auditoría de seguridad..."
./scripts/security-audit.sh

# 2. Actualización completa del sistema
echo "2. Actualizando sistema operativo..."
read -p "¿Actualizar sistema operativo? (s/N): " update_os
if [[ "$update_os" =~ ^[sS]$ ]]; then
    # Backup antes de actualizar
    ./scripts/backup.sh
    
    # Actualizar sistema
    sudo apt update && sudo apt upgrade -y
    sudo apt autoremove -y
    sudo apt autoclean
    
    echo "✅ Sistema actualizado"
else
    echo "⏭️  Actualización de SO omitida"
fi

# 3. Optimización de base de datos
echo "3. Optimizando base de datos..."
if [ -f "database/contacts.db" ]; then
    # Crear backup antes de optimizar
    cp database/contacts.db database/contacts.db.backup
    
    # Optimizar y limpiar
    sqlite3 database/contacts.db << 'EOF'
VACUUM;
PRAGMA integrity_check;
PRAGMA optimize;
EOF
    
    echo "✅ Base de datos optimizada"
fi

# 4. Rotación de secrets y credenciales
echo "4. Verificando rotación de credenciales..."
ENV_AGE=$(stat -c %Y .env)
CURRENT_TIME=$(date +%s)
DAYS_OLD=$(( (CURRENT_TIME - ENV_AGE) / 86400 ))

if [ $DAYS_OLD -gt 90 ]; then
    echo "⚠️  El archivo .env tiene $DAYS_OLD días"
    echo "   Considera rotar las siguientes credenciales:"
    echo "   - JWT_SECRET"
    echo "   - SESSION_SECRET"
    echo "   - Contraseñas de email"
    echo "   - Claves de reCAPTCHA (si han sido comprometidas)"
else
    echo "✅ Credenciales tienen $DAYS_OLD días (OK)"
fi

# 5. Análisis de performance mensual
echo "5. Analizando performance mensual..."
PERF_DIR="performance/month_$(date +%Y%m)"
mkdir -p "$PERF_DIR"

# Estadísticas de uptime
uptime > "$PERF_DIR/uptime.txt"

# Uso de recursos promedio
{
    echo "=== USO DE RECURSOS DEL MES ==="
    echo "CPU Load Average: $(uptime | awk '{print $NF}')"
    echo "Memoria: $(free -h)"
    echo "Disco: $(df -h)"
    echo "Procesos Node.js: $(ps aux | grep node | grep -v grep | wc -l)"
} > "$PERF_DIR/resources.txt"

# 6. Limpieza profunda
echo "6. Realizando limpieza profunda..."

# Limpiar npm cache
npm cache clean --force

# Limpiar logs antiguos (mantener últimos 30 días)
find logs/ -name "*.log" -mtime +30 -delete

# Limpiar backups antiguos (mantener últimos 60 días)
find backups/ -name "backup_*.tar.gz" -mtime +60 -delete

# Limpiar archivos temporales del sistema
sudo apt autoclean
sudo journalctl --vacuum-time=30d

echo "✅ Limpieza profunda completada"

# 7. Test completo de funcionalidad
echo "7. Ejecutando tests de funcionalidad..."

# Health checks
HEALTH_RESULTS=""
if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    HEALTH_RESULTS="✅ API Health: OK"
else
    HEALTH_RESULTS="❌ API Health: FAILED"
fi

# SSL Test
source .env 2>/dev/null
SSL_RESULTS=""
if [ ! -z "$DOMAIN" ]; then
    if curl -sf "https://$DOMAIN/api/health" >/dev/null 2>&1; then
        SSL_RESULTS="✅ HTTPS: OK"
    else
        SSL_RESULTS="❌ HTTPS: FAILED"
    fi
fi

# 8. Reporte mensual completo
cat > "$PERF_DIR/monthly_report.txt" << EOF
REPORTE MENSUAL DE MANTENIMIENTO
===============================
Fecha: $(date)
Mes: $(date +%Y-%m)

RESUMEN EJECUTIVO:
================
$HEALTH_RESULTS
$SSL_RESULTS
Sistema operativo: $([ "$update_os" = "s" ] && echo "Actualizado" || echo "Sin actualizar")
Base de datos: Optimizada y verificada
Credenciales: $DAYS_OLD días de antigüedad
Limpieza: Completada

ESTADÍSTICAS DEL MES:
===================
Uptime: $(uptime -p)
Consultas totales: $(sqlite3 database/contacts.db "SELECT COUNT(*) FROM contacts WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now');" 2>/dev/null || echo "N/A")
Consultas promedio/día: $(sqlite3 database/contacts.db "SELECT ROUND(COUNT(*) / 30.0, 1) FROM contacts WHERE created_at >= datetime('now', '-30 days');" 2>/dev/null || echo "N/A")
Espacio usado: $(df -h / | tail -1 | awk '{print $5}')
Backups creados este mes: $(find backups/ -name "backup_*.tar.gz" -mtime -30 | wc -l)

TAREAS REALIZADAS:
================
✅ Auditoría completa de seguridad
$([ "$update_os" = "s" ] && echo "✅ Sistema operativo actualizado" || echo "⏭️ Actualización de SO omitida")
✅ Base de datos optimizada
✅ Performance analizado
✅ Limpieza profunda realizada
✅ Tests de funcionalidad ejecutados

RECOMENDACIONES:
==============
$([ $DAYS_OLD -gt 90 ] && echo "⚠️ Considerar rotación de credenciales" || echo "✅ Credenciales actuales")
$([ $(echo "$HEALTH_RESULTS" | grep -c "FAILED") -gt 0 ] && echo "❌ Revisar problemas de conectividad" || echo "✅ Conectividad OK")
📊 Revisar archivos de performance generados
🔒 Implementar recomendaciones de la auditoría de seguridad

PRÓXIMO MANTENIMIENTO:
====================
Fecha programada: $(date -d "+1 month" +%Y-%m-%d)
Tareas pendientes: $([ $DAYS_OLD -gt 90 ] && echo "Rotación de credenciales" || echo "Mantenimiento de rutina")
EOF

echo "📊 Reporte mensual generado: $PERF_DIR/monthly_report.txt"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Mantenimiento mensual completado" >> logs/maintenance.log

echo
echo "✅ MANTENIMIENTO MENSUAL COMPLETADO"
echo "📁 Ver reportes en: $PERF_DIR/"
echo "📋 Revisar recomendaciones en el reporte mensual"
```

### 📋 Checklist Manual Mensual

- [ ] **Auditoría de seguridad completa**: Revisar resultados
- [ ] **Actualizar certificaciones**: SSL, dominios, etc.
- [ ] **Revisar métricas de negocio**: Consultas, conversiones
- [ ] **Optimizar contenido**: Imágenes, textos, SEO
- [ ] **Test de disaster recovery**: Probar restauración completa
- [ ] **Actualizar documentación**: Si hubo cambios
- [ ] **Planificar mejoras**: Para el próximo mes

---

## 🔄 Actualizaciones del Sistema

### 📦 Actualización de la Aplicación

```bash
# Script: scripts/app-update.sh
#!/bin/bash

echo "=== ACTUALIZACIÓN DE LA APLICACIÓN ==="
echo

# 1. Backup previo
echo "1. Creando backup de seguridad..."
./scripts/backup.sh

# 2. Verificar actualizaciones disponibles
echo "2. Verificando actualizaciones..."
npm outdated
npm audit

# 3. Parar aplicación (mantener nginx)
echo "3. Deteniendo aplicación..."
sudo systemctl stop reparacion-pc

# 4. Actualizar dependencias
echo "4. Actualizando dependencias..."

# Actualizar dependencias de seguridad críticas
npm audit fix

# Actualizar dependencias menores (opcional)
read -p "¿Actualizar dependencias menores? (s/N): " update_deps
if [[ "$update_deps" =~ ^[sS]$ ]]; then
    npm update
fi

# 5. Verificar configuración
echo "5. Verificando configuración..."
if [ -f ".env.example" ]; then
    echo "   Verificando nuevas variables de configuración..."
    
    # Comparar .env con .env.example para encontrar variables faltantes
    missing_vars=()
    while IFS= read -r line; do
        if [[ $line =~ ^[A-Z_]+ ]] && ! grep -q "^${line%%=*}=" .env 2>/dev/null; then
            missing_vars+=("${line%%=*}")
        fi
    done < .env.example
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo "   ⚠️  Variables faltantes en .env:"
        printf '   - %s\n' "${missing_vars[@]}"
        echo "   Revisa .env.example y añade las variables necesarias"
    else
        echo "   ✅ Configuración completa"
    fi
fi

# 6. Reiniciar aplicación
echo "6. Reiniciando aplicación..."
sudo systemctl start reparacion-pc

# 7. Verificar funcionamiento
echo "7. Verificando funcionamiento..."
sleep 5

if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "   ✅ Aplicación funcionando correctamente"
else
    echo "   ❌ Error en la aplicación - Verificando logs..."
    sudo journalctl -u reparacion-pc --lines=20 --no-pager
fi

echo "✅ Actualización de aplicación completada"
```

### 🔧 Actualización del Sistema Operativo

```bash
# Script: scripts/system-update.sh
#!/bin/bash

echo "=== ACTUALIZACIÓN DEL SISTEMA OPERATIVO ==="
echo

# 1. Verificar actualizaciones disponibles
echo "1. Verificando actualizaciones disponibles..."
apt list --upgradable

# 2. Backup completo antes de actualizar
echo "2. Creando backup completo..."
./scripts/backup.sh

# 3. Actualizar lista de paquetes
echo "3. Actualizando lista de paquetes..."
sudo apt update

# 4. Mostrar actualizaciones y confirmar
echo "4. Actualizaciones disponibles:"
apt list --upgradable

read -p "¿Continuar con las actualizaciones? (s/N): " continue_update
if [[ ! "$continue_update" =~ ^[sS]$ ]]; then
    echo "Actualización cancelada"
    exit 0
fi

# 5. Actualizar sistema
echo "5. Actualizando sistema..."
sudo apt upgrade -y

# 6. Actualizar firmware si es necesario
if command -v fwupdmgr >/dev/null 2>&1; then
    echo "6. Verificando actualizaciones de firmware..."
    sudo fwupdmgr get-updates || true
fi

# 7. Limpiar paquetes no necesarios
echo "7. Limpiando paquetes..."
sudo apt autoremove -y
sudo apt autoclean

# 8. Verificar si se requiere reinicio
echo "8. Verificando necesidad de reinicio..."
if [ -f /var/run/reboot-required ]; then
    echo "⚠️  REINICIO REQUERIDO"
    echo "   Servicios que requieren reinicio:"
    cat /var/run/reboot-required.pkgs 2>/dev/null || echo "   Sistema completo"
    
    read -p "¿Reiniciar ahora? (s/N): " reboot_now
    if [[ "$reboot_now" =~ ^[sS]$ ]]; then
        echo "Reiniciando sistema en 10 segundos..."
        sleep 10
        sudo reboot
    else
        echo "⚠️  Recuerda reiniciar el sistema cuando sea posible"
    fi
else
    echo "✅ No se requiere reinicio"
fi

# 9. Verificar servicios después de actualización
echo "9. Verificando servicios..."
systemctl is-active --quiet reparacion-pc && echo "   ✅ Aplicación: OK" || echo "   ❌ Aplicación: PROBLEMAS"
systemctl is-active --quiet nginx && echo "   ✅ Nginx: OK" || echo "   ❌ Nginx: PROBLEMAS"

echo "✅ Actualización del sistema completada"
```

---

## 📊 Monitoreo y Alertas

### 🔔 Sistema de Monitoreo Continuo

```bash
# Script: scripts/monitoring-setup.sh
#!/bin/bash

echo "=== CONFIGURACIÓN DE MONITOREO CONTINUO ==="

# 1. Crear script de monitoreo principal
cat > scripts/monitor-system.sh << 'EOF'
#!/bin/bash

MONITOR_LOG="logs/monitor.log"
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEM=85
ALERT_THRESHOLD_DISK=90

monitor_log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - MONITOR - $1" | tee -a "$MONITOR_LOG"
}

# Verificar servicios
check_services() {
    for service in reparacion-pc nginx; do
        if ! systemctl is-active --quiet $service; then
            monitor_log "ALERT: Servicio $service está inactivo"
            
            # Intentar reinicio automático
            systemctl restart $service
            sleep 5
            
            if systemctl is-active --quiet $service; then
                monitor_log "INFO: Servicio $service reiniciado exitosamente"
            else
                monitor_log "CRITICAL: No se pudo reiniciar $service"
            fi
        fi
    done
}

# Verificar recursos del sistema
check_resources() {
    # CPU
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    if (( $(echo "$CPU_USAGE > $ALERT_THRESHOLD_CPU" | bc -l) )); then
        monitor_log "ALERT: Alto uso de CPU: ${CPU_USAGE}%"
    fi
    
    # Memoria
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    if (( $(echo "$MEM_USAGE > $ALERT_THRESHOLD_MEM" | bc -l) )); then
        monitor_log "ALERT: Alto uso de memoria: ${MEM_USAGE}%"
    fi
    
    # Disco
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt $ALERT_THRESHOLD_DISK ]; then
        monitor_log "ALERT: Alto uso de disco: ${DISK_USAGE}%"
    fi
}

# Verificar conectividad
check_connectivity() {
    if ! curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
        monitor_log "ALERT: Health check fallido"
    fi
    
    # Verificar conectividad externa
    if ! ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        monitor_log "ALERT: Sin conectividad externa"
    fi
}

# Ejecutar verificaciones
check_services
check_resources
check_connectivity

# Limpiar log viejo (mantener últimos 7 días)
find logs/ -name "monitor.log" -mtime +7 -delete
EOF

chmod +x scripts/monitor-system.sh

# 2. Configurar cron para monitoreo cada 5 minutos
echo "Configurando monitoreo automático..."
(crontab -l 2>/dev/null | grep -v "monitor-system.sh"; echo "*/5 * * * * cd $(pwd) && ./scripts/monitor-system.sh") | crontab -

echo "✅ Monitoreo continuo configurado"
echo "📊 Ver logs: tail -f logs/monitor.log"
```

### 📈 Dashboard de Monitoreo

```bash
# Script: scripts/monitoring-dashboard.sh
#!/bin/bash

while true; do
    clear
    echo "════════════════════════════════════════════════"
    echo "    📊 DASHBOARD DE MONITOREO EN TIEMPO REAL"
    echo "════════════════════════════════════════════════"
    echo "Actualizado: $(date)"
    echo

    # Estado de servicios
    echo "⚙️  SERVICIOS:"
    systemctl is-active --quiet reparacion-pc && echo "   ✅ Aplicación: FUNCIONANDO" || echo "   ❌ Aplicación: PARADA"
    systemctl is-active --quiet nginx && echo "   ✅ Nginx: FUNCIONANDO" || echo "   ❌ Nginx: PARADO"
    echo

    # Recursos del sistema
    echo "💻 RECURSOS DEL SISTEMA:"
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}')
    LOAD_AVG=$(uptime | awk '{print $NF}')
    
    echo "   🖥️  CPU: ${CPU_USAGE}%"
    echo "   🧠 Memoria: ${MEM_USAGE}%"
    echo "   💾 Disco: ${DISK_USAGE}"
    echo "   ⚖️  Load: ${LOAD_AVG}"
    echo

    # Conectividad
    echo "🌐 CONECTIVIDAD:"
    if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
        echo "   ✅ Health Check: OK"
    else
        echo "   ❌ Health Check: FAILED"
    fi
    
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        echo "   ✅ Internet: CONECTADO"
    else
        echo "   ❌ Internet: DESCONECTADO"
    fi
    echo

    # Estadísticas de la aplicación
    echo "📊 APLICACIÓN:"
    if [ -f "database/contacts.db" ]; then
        TODAY_CONTACTS=$(sqlite3 database/contacts.db "SELECT COUNT(*) FROM contacts WHERE date(created_at) = date('now');" 2>/dev/null || echo "N/A")
        TOTAL_CONTACTS=$(sqlite3 database/contacts.db "SELECT COUNT(*) FROM contacts;" 2>/dev/null || echo "N/A")
        echo "   📧 Consultas hoy: $TODAY_CONTACTS"
        echo "   📈 Total consultas: $TOTAL_CONTACTS"
    fi
    echo

    # Últimas alertas
    echo "🚨 ÚLTIMAS ALERTAS:"
    if [ -f "logs/monitor.log" ]; then
        tail -3 logs/monitor.log | while read line; do
            echo "   $line"
        done
    else
        echo "   Sin alertas recientes"
    fi

    echo
    echo "════════════════════════════════════════════════"
    echo "Presiona Ctrl+C para salir | Auto-refresh: 30s"
    echo "════════════════════════════════════════════════"
    
    sleep 30
done
```

---

## ⚡ Optimización de Performance

### 🚀 Análisis y Optimización

```bash
# Script: scripts/performance-optimization.sh
#!/bin/bash

echo "=== ANÁLISIS Y OPTIMIZACIÓN DE PERFORMANCE ==="
echo

PERF_DIR="performance/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$PERF_DIR"

# 1. Análisis de performance actual
echo "1. Analizando performance actual..."

# Benchmark de la aplicación
echo "   Ejecutando benchmark..."
ab -n 100 -c 10 http://localhost:3000/ > "$PERF_DIR/benchmark.txt" 2>&1

# Análisis de memoria de Node.js
echo "   Analizando uso de memoria..."
NODE_PID=$(pgrep -f "node backend/server.js")
if [ ! -z "$NODE_PID" ]; then
    ps -p $NODE_PID -o pid,vsz,rss,pcpu,pmem,cmd > "$PERF_DIR/node_memory.txt"
fi

# 2. Optimización de base de datos
echo "2. Optimizando base de datos..."
if [ -f "database/contacts.db" ]; then
    echo "   Ejecutando VACUUM y ANALYZE..."
    sqlite3 database/contacts.db << 'EOF'
VACUUM;
ANALYZE;
PRAGMA optimize;
EOF
    echo "   ✅ Base de datos optimizada"
fi

# 3. Análisis de logs de nginx
echo "3. Analizando logs de performance..."
if [ -f "/var/log/nginx/access.log" ]; then
    # Tiempo de respuesta promedio
    echo "   Analizando tiempos de respuesta..."
    awk '{print $(NF-1)}' /var/log/nginx/access.log | tail -1000 | \
    awk '{sum+=$1; count++} END {print "Tiempo respuesta promedio (últimas 1000): " sum/count " segundos"}' > "$PERF_DIR/response_times.txt"
    
    # Endpoints más lentos
    awk '{print $(NF-1), $7}' /var/log/nginx/access.log | tail -1000 | \
    sort -nr | head -10 > "$PERF_DIR/slow_endpoints.txt"
fi

# 4. Optimización de archivos estáticos
echo "4. Verificando optimización de archivos estáticos..."
{
    echo "=== ANÁLISIS DE ARCHIVOS ESTÁTICOS ==="
    echo
    echo "Archivos CSS grandes (>50KB):"
    find frontend/css -name "*.css" -size +50k -exec ls -lh {} \; 2>/dev/null || echo "Ninguno encontrado"
    
    echo
    echo "Archivos JS grandes (>100KB):"
    find frontend/js -name "*.js" -size +100k -exec ls -lh {} \; 2>/dev/null || echo "Ninguno encontrado"
    
    echo
    echo "Imágenes grandes (>500KB):"
    find frontend/images -name "*.jpg" -o -name "*.png" -o -name "*.gif" | \
    xargs ls -lh 2>/dev/null | awk '$5 > 500*1024 {print}' || echo "Ninguna encontrada"
} > "$PERF_DIR/static_files_analysis.txt"

# 5. Recomendaciones de optimización
echo "5. Generando recomendaciones..."
cat > "$PERF_DIR/optimization_recommendations.txt" << EOF
RECOMENDACIONES DE OPTIMIZACIÓN
==============================
Fecha: $(date)

APLICACIÓN NODE.JS:
==================
$([ ! -z "$NODE_PID" ] && echo "✅ Aplicación corriendo (PID: $NODE_PID)" || echo "❌ Aplicación no detectada")

Recomendaciones:
- Considerar clustering si CPU > 70% consistente
- Implementar cache en memoria para consultas frecuentes
- Revisar queries de base de datos para optimización

BASE DE DATOS:
=============
✅ Optimización ejecutada (VACUUM, ANALYZE, PRAGMA optimize)

Recomendaciones:
- Programar optimización automática semanal
- Considerar índices adicionales si hay consultas lentas
- Monitorear crecimiento de la base de datos

ARCHIVOS ESTÁTICOS:
==================
Ver static_files_analysis.txt para detalles

Recomendaciones generales:
- Comprimir imágenes grandes (usar WebP si es posible)
- Minificar CSS y JavaScript
- Habilitar compresión gzip en nginx (ya configurado)
- Considerar CDN para archivos estáticos si el tráfico es alto

PERFORMANCE WEB:
===============
Ver benchmark.txt para métricas detalladas

Próximos pasos recomendados:
1. Monitorear métricas regularmente
2. Implementar cache de aplicación si es necesario
3. Optimizar imágenes identificadas como grandes
4. Considerar lazy loading para contenido no crítico
EOF

# 6. Script de monitoreo de performance
cat > scripts/performance-monitor.sh << 'EOF'
#!/bin/bash

# Monitor de performance en tiempo real
echo "Iniciando monitor de performance... (Ctrl+C para salir)"

while true; do
    # CPU y memoria de Node.js
    NODE_PID=$(pgrep -f "node backend/server.js")
    if [ ! -z "$NODE_PID" ]; then
        NODE_STATS=$(ps -p $NODE_PID -o pcpu,pmem --no-headers)
        echo "$(date '+%H:%M:%S') - Node.js CPU: $(echo $NODE_STATS | awk '{print $1}')% MEM: $(echo $NODE_STATS | awk '{print $2}')%"
    fi
    
    # Tiempo de respuesta
    RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:3000/api/health)
    echo "$(date '+%H:%M:%S') - Response time: ${RESPONSE_TIME}s"
    
    sleep 10
done
EOF

chmod +x scripts/performance-monitor.sh

echo
echo "✅ ANÁLISIS DE PERFORMANCE COMPLETADO"
echo "📁 Resultados guardados en: $PERF_DIR"
echo "📊 Para monitoreo continuo: ./scripts/performance-monitor.sh"
echo
echo "📋 ARCHIVOS GENERADOS:"
echo "   - benchmark.txt: Resultados de benchmark"
echo "   - node_memory.txt: Uso de memoria de Node.js"
echo "   - response_times.txt: Análisis de tiempos de respuesta"
echo "   - slow_endpoints.txt: Endpoints más lentos"
echo "   - static_files_analysis.txt: Análisis de archivos estáticos"
echo "   - optimization_recommendations.txt: Recomendaciones"
```

---

## 🆘 Resolución de Problemas

### 🔧 Diagnóstico Automático

```bash
# Script: scripts/diagnostics.sh
#!/bin/bash

echo "=== DIAGNÓSTICO AUTOMÁTICO DEL SISTEMA ==="
echo "Fecha: $(date)"
echo

DIAG_DIR="diagnostics/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$DIAG_DIR"

# 1. Información general del sistema
echo "1. Recopilando información del sistema..."
{
    echo "=== INFORMACIÓN DEL SISTEMA ==="
    echo "Fecha: $(date)"
    echo "Hostname: $(hostname)"
    echo "Sistema: $(uname -a)"
    echo "Uptime: $(uptime)"
    echo "Usuarios conectados: $(who | wc -l)"
    echo
} > "$DIAG_DIR/system_info.txt"

# 2. Estado de servicios
echo "2. Verificando servicios..."
{
    echo "=== ESTADO DE SERVICIOS ==="
    for service in reparacion-pc nginx; do
        echo "Servicio: $service"
        systemctl status $service --no-pager
        echo "----------------------------------------"
    done
} > "$DIAG_DIR/services_status.txt"

# 3. Recursos del sistema
echo "3. Analizando recursos..."
{
    echo "=== RECURSOS DEL SISTEMA ==="
    echo "CPU:"
    top -bn1 | head -5
    echo
    echo "Memoria:"
    free -h
    echo
    echo "Disco:"
    df -h
    echo
    echo "Procesos más pesados:"
    ps aux --sort=-%cpu | head -10
} > "$DIAG_DIR/resources.txt"

# 4. Conectividad de red
echo "4. Verificando conectividad..."
{
    echo "=== CONECTIVIDAD DE RED ==="
    echo "Interfaces de red:"
    ip addr show
    echo
    echo "Rutas:"
    ip route
    echo
    echo "Puertos abiertos:"
    netstat -tuln | grep LISTEN
    echo
    echo "Test de conectividad:"
    echo "Google DNS (8.8.8.8):"
    ping -c 3 8.8.8.8
    echo
    echo "Localhost:"
    curl -I http://localhost:3000/api/health
} > "$DIAG_DIR/network.txt" 2>&1

# 5. Logs críticos
echo "5. Recopilando logs críticos..."
{
    echo "=== LOGS DE LA APLICACIÓN ==="
    echo "Últimos 50 logs de la aplicación:"
    tail -50 logs/app.log 2>/dev/null || echo "Log no disponible"
    echo
    echo "Errores recientes:"
    grep -i error logs/app.log 2>/dev/null | tail -20 || echo "No hay errores"
} > "$DIAG_DIR/app_logs.txt"

{
    echo "=== LOGS DEL SISTEMA ==="
    echo "Logs de systemd (aplicación):"
    journalctl -u reparacion-pc --lines=30 --no-pager
    echo
    echo "Logs de nginx:"
    journalctl -u nginx --lines=30 --no-pager
    echo
    echo "Errores de nginx:"
    tail -20 /var/log/nginx/error.log 2>/dev/null || echo "Log no disponible"
} > "$DIAG_DIR/system_logs.txt"

# 6. Verificación de configuración
echo "6. Verificando configuración..."
{
    echo "=== VERIFICACIÓN DE CONFIGURACIÓN ==="
    echo "Archivo .env existe:"
    [ -f .env ] && echo "✅ Sí" || echo "❌ No"
    
    echo
    echo "Variables críticas configuradas:"
    if [ -f .env ]; then
        source .env
        [ ! -z "$DOMAIN" ] && echo "✅ DOMAIN: $DOMAIN" || echo "❌ DOMAIN no configurado"
        [ ! -z "$PORT" ] && echo "✅ PORT: $PORT" || echo "❌ PORT no configurado"
        [ ! -z "$EMAIL_USER" ] && echo "✅ EMAIL_USER configurado" || echo "❌ EMAIL_USER no configurado"
        [ ! -z "$JWT_SECRET" ] && echo "✅ JWT_SECRET configurado" || echo "❌ JWT_SECRET no configurado"
    fi
    
    echo
    echo "Base de datos:"
    if [ -f "database/contacts.db" ]; then
        echo "✅ Base de datos existe"
        sqlite3 database/contacts.db "PRAGMA integrity_check;" 2>/dev/null || echo "❌ Error en integridad"
    else
        echo "❌ Base de datos no encontrada"
    fi
    
    echo
    echo "Nginx configuración:"
    nginx -t 2>&1
} > "$DIAG_DIR/configuration.txt"

# 7. Tests de funcionalidad
echo "7. Ejecutando tests de funcionalidad..."
{
    echo "=== TESTS DE FUNCIONALIDAD ==="
    
    echo "Health check interno:"
    if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
        echo "✅ OK"
    else
        echo "❌ FAILED"
    fi
    
    echo
    echo "Health check externo (si SSL configurado):"
    source .env 2>/dev/null
    if [ ! -z "$DOMAIN" ]; then
        if curl -sf "https://$DOMAIN/api/health" >/dev/null 2>&1; then
            echo "✅ OK"
        else
            echo "❌ FAILED"
        fi
    else
        echo "⏭️ Dominio no configurado"
    fi
    
    echo
    echo "Test de base de datos:"
    if sqlite3 database/contacts.db "SELECT COUNT(*) FROM contacts;" >/dev/null 2>&1; then
        echo "✅ OK"
    else
        echo "❌ FAILED"
    fi
} > "$DIAG_DIR/functionality_tests.txt"

# 8. Generar reporte de diagnóstico
echo "8. Generando reporte de diagnóstico..."
{
    echo "======================================="
    echo "    REPORTE DE DIAGNÓSTICO AUTOMÁTICO"
    echo "======================================="
    echo "Generado: $(date)"
    echo "Sistema: $(hostname)"
    echo

    echo "📊 RESUMEN EJECUTIVO:"
    echo "===================="
    
    # Estado general
    if systemctl is-active --quiet reparacion-pc && systemctl is-active --quiet nginx; then
        echo "🟢 Estado general: FUNCIONANDO"
    else
        echo "🔴 Estado general: PROBLEMAS DETECTADOS"
    fi
    
    # Recursos críticos
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    
    if [ $DISK_USAGE -lt 90 ] && [ $MEM_USAGE -lt 90 ]; then
        echo "🟢 Recursos: OK"
    else
        echo "🟡 Recursos: ALTO USO (Disco: ${DISK_USAGE}%, Memoria: ${MEM_USAGE}%)"
    fi
    
    # Conectividad
    if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
        echo "🟢 Conectividad: OK"
    else
        echo "🔴 Conectividad: PROBLEMAS"
    fi
    
    echo
    echo "🔍 PROBLEMAS DETECTADOS:"
    echo "======================"
    
    # Verificar servicios
    for service in reparacion-pc nginx; do
        if ! systemctl is-active --quiet $service; then
            echo "❌ Servicio $service no está activo"
        fi
    done
    
    # Verificar recursos
    if [ $DISK_USAGE -gt 90 ]; then
        echo "⚠️ Espacio en disco crítico: ${DISK_USAGE}%"
    fi
    
    if [ $MEM_USAGE -gt 90 ]; then
        echo "⚠️ Memoria crítica: ${MEM_USAGE}%"
    fi
    
    # Verificar configuración
    if [ ! -f .env ]; then
        echo "❌ Archivo .env no encontrado"
    fi
    
    if [ ! -f "database/contacts.db" ]; then
        echo "❌ Base de datos no encontrada"
    fi
    
    echo
    echo "📋 ARCHIVOS GENERADOS:"
    echo "===================="
    ls -la "$DIAG_DIR"/*.txt | awk '{print "📄 " $NF}'
    
    echo
    echo "🔧 PRÓXIMOS PASOS RECOMENDADOS:"
    echo "============================"
    echo "1. Revisar todos los archivos de diagnóstico generados"
    echo "2. Verificar logs de error para problemas específicos"  
    echo "3. Si hay servicios inactivos, intentar reiniciarlos"
    echo "4. Si hay problemas de recursos, ejecutar limpieza"
    echo "5. Si hay problemas de configuración, verificar .env"
    
} > "$DIAG_DIR/diagnostic_report.txt"

echo
echo "✅ DIAGNÓSTICO COMPLETADO"
echo "📁 Resultados guardados en: $DIAG_DIR"
echo "📋 Ver reporte principal: $DIAG_DIR/diagnostic_report.txt"
echo
echo "Para resolver problemas comunes, consulta docs/TROUBLESHOOTING.md"
```

---

## 📅 Calendario de Mantenimiento

### 🗓️ Programación Recomendada

```bash
# Configurar todos los cron jobs de mantenimiento
cat > scripts/setup-maintenance-schedule.sh << 'EOF'
#!/bin/bash

echo "=== CONFIGURACIÓN DEL CALENDARIO DE MANTENIMIENTO ==="

# Eliminar cron jobs anteriores relacionados con mantenimiento
crontab -l 2>/dev/null | grep -v "daily-maintenance\|weekly-maintenance\|monthly-maintenance\|backup.sh" | crontab -

# Programar mantenimiento diario a las 6:00 AM
(crontab -l 2>/dev/null; echo "0 6 * * * cd $(pwd) && ./scripts/daily-maintenance.sh") | crontab -

# Programar mantenimiento semanal los domingos a las 3:00 AM  
(crontab -l 2>/dev/null; echo "0 3 * * 0 cd $(pwd) && ./scripts/weekly-maintenance.sh") | crontab -

# Programar mantenimiento mensual el primer día del mes a las 2:00 AM
(crontab -l 2>/dev/null; echo "0 2 1 * * cd $(pwd) && ./scripts/monthly-maintenance.sh") | crontab -

# Programar backup diario a las 1:00 AM
(crontab -l 2>/dev/null; echo "0 1 * * * cd $(pwd) && ./scripts/backup.sh --silent") | crontab -

echo "✅ Calendario de mantenimiento configurado:"
echo
crontab -l | grep -E "(daily-maintenance|weekly-maintenance|monthly-maintenance|backup.sh)"
EOF

chmod +x scripts/setup-maintenance-schedule.sh
```

### 📊 Resumen de Frecuencias

| Tarea | Frecuencia | Hora | Descripción |
|-------|------------|------|-------------|
| **Backup** | Diario | 01:00 | Backup automático de DB y archivos |
| **Mantenimiento Diario** | Diario | 06:00 | Verificaciones básicas y limpieza |
| **Mantenimiento Semanal** | Domingo | 03:00 | Análisis y optimización |
| **Mantenimiento Mensual** | Día 1 | 02:00 | Auditoría completa y actualizaciones |
| **Monitoreo** | Cada 5 min | Siempre | Verificación de servicios |
| **DNS Update** | Cada 5 min | Siempre | Actualización IP dinámica |

---

## ✅ Checklists de Mantenimiento

### 📋 Checklist Diario (Manual)
```
[ ] Verificar servicios funcionando
[ ] Revisar logs de errores  
[ ] Verificar consultas recibidas
[ ] Confirmar backup nocturno
[ ] Verificar SSL válido
[ ] Revisar espacio en disco
```

### 📋 Checklist Semanal (Manual)
```
[ ] Revisar estadísticas de tráfico
[ ] Verificar performance de la aplicación
[ ] Revisar fail2ban y seguridad
[ ] Actualizar dependencias si es necesario
[ ] Test de recovery de backup
[ ] Verificar integridad de archivos
```

### 📋 Checklist Mensual (Manual)
```
[ ] Ejecutar auditoría completa de seguridad
[ ] Actualizar sistema operativo
[ ] Revisar y rotar credenciales si es necesario
[ ] Analizar métricas de negocio
[ ] Optimizar base de datos manualmente
[ ] Actualizar documentación
[ ] Planificar mejoras para el próximo mes
```

---

Con este sistema completo de mantenimiento, tu servicio de reparación PC se mantendrá funcionando de manera óptima, segura y confiable. El mantenimiento automatizado se encarga de las tareas rutinarias, mientras que las verificaciones manuales aseguran que todo funcione según lo esperado. 🔧✨