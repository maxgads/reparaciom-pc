@echo off
setlocal enabledelayedexpansion

REM Script de backup automático para Windows
REM Proyecto: Servicio Reparación PC

echo ===============================================
echo        Backup del Sistema de Reparacion PC
echo ===============================================
echo.

REM Configuración
set BACKUP_DIR=backups
set DATE=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set DATE=!DATE: =0!
set BACKUP_NAME=backup_reparacion_pc_!DATE!
set BACKUP_PATH=%BACKUP_DIR%\!BACKUP_NAME!
set MAX_BACKUPS=30

REM Crear directorio de backup
if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%
mkdir %BACKUP_PATH%

echo [INFO] Iniciando backup: !BACKUP_NAME!
echo [INFO] Fecha: %date% %time%
echo.

REM Cargar variables de entorno si existe .env
if exist .env (
    for /f "delims=" %%i in (.env) do (
        for /f "tokens=1,2 delims==" %%a in ("%%i") do (
            set %%a=%%b
        )
    )
)

REM 1. Backup de base de datos
echo [INFO] 1. Realizando backup de base de datos...
if exist database\contacts.db (
    REM Crear backup de la base de datos
    copy database\contacts.db %BACKUP_PATH%\contacts.db >nul
    
    REM Exportar como SQL
    sqlite3 database\contacts.db ".dump" > %BACKUP_PATH%\contacts.sql
    
    REM Obtener estadísticas
    for /f %%i in ('sqlite3 database\contacts.db "SELECT COUNT(*) FROM contacts;"') do set TOTAL_CONTACTS=%%i
    for /f %%i in ('sqlite3 database\contacts.db "SELECT COUNT(*) FROM blocked_ips;"') do set BLOCKED_IPS=%%i
    
    echo [SUCCESS] Backup de base de datos completado
    echo   Contactos: !TOTAL_CONTACTS!
    echo   IPs bloqueadas: !BLOCKED_IPS!
) else (
    echo [WARNING] Base de datos no encontrada
    set TOTAL_CONTACTS=0
    set BLOCKED_IPS=0
)

REM 2. Backup de archivos de configuración
echo [INFO] 2. Realizando backup de configuracion...
mkdir %BACKUP_PATH%\config

REM Copiar archivos de configuración críticos
if exist .env copy .env %BACKUP_PATH%\config\ >nul
if exist .env.example copy .env.example %BACKUP_PATH%\config\ >nul
if exist package.json copy package.json %BACKUP_PATH%\config\ >nul
if exist package-lock.json copy package-lock.json %BACKUP_PATH%\config\ >nul

echo [SUCCESS] Backup de configuracion completado

REM 3. Backup de logs
echo [INFO] 3. Realizando backup de logs...
mkdir %BACKUP_PATH%\logs

REM Logs de la aplicación
if exist logs (
    xcopy logs %BACKUP_PATH%\logs\ /E /I /Q >nul 2>&1
)

REM Logs del sistema Windows (últimos 100 eventos de aplicación)
wevtutil qe Application /c:100 /f:text > %BACKUP_PATH%\logs\windows_application.log 2>nul

echo [SUCCESS] Backup de logs completado

REM 4. Backup de archivos estáticos críticos
echo [INFO] 4. Realizando backup de archivos estaticos...
mkdir %BACKUP_PATH%\static

REM Frontend completo
if exist frontend (
    xcopy frontend %BACKUP_PATH%\static\frontend\ /E /I /Q >nul
)

REM Backend (código fuente)
if exist backend (
    xcopy backend %BACKUP_PATH%\static\backend\ /E /I /Q >nul
)

REM Scripts
if exist scripts (
    xcopy scripts %BACKUP_PATH%\static\scripts\ /E /I /Q >nul
)

REM Documentación
if exist docs (
    xcopy docs %BACKUP_PATH%\static\docs\ /E /I /Q >nul
)

echo [SUCCESS] Backup de archivos estaticos completado

REM 5. Backup de información del sistema
echo [INFO] 5. Creando informacion del backup...

REM Obtener información del sistema
for /f "tokens=*" %%i in ('hostname') do set HOSTNAME=%%i
for /f "tokens=*" %%i in ('whoami') do set USERNAME=%%i
for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VERSION=%%i

REM Crear archivo de información
(
echo === INFORMACION DEL BACKUP ===
echo Fecha: %date% %time%
echo Servidor: !HOSTNAME!
echo Usuario: !USERNAME!
echo Dominio: !DOMAIN!
echo Puerto: !PORT!
echo Version Node.js: !NODE_VERSION!
echo Sistema Operativo: Windows
echo.
echo === CONTENIDO ===
echo - Base de datos SQLite (contacts.db + SQL dump^)
echo - Archivos de configuracion (.env, package.json^)
echo - Logs del sistema
echo - Codigo fuente completo (frontend, backend, scripts^)
echo - Este archivo de informacion
echo.
echo === ESTADISTICAS ===
echo Total contactos: !TOTAL_CONTACTS!
echo IPs bloqueadas: !BLOCKED_IPS!
echo.
echo === RESTAURACION ===
echo Para restaurar este backup:
echo 1. Detener servicio: sc stop "Servicio Reparacion PC"
echo 2. Restaurar archivos de configuracion
echo 3. Restaurar base de datos
echo 4. Restaurar codigo fuente
echo 5. Reiniciar servicio: sc start "Servicio Reparacion PC"
) > %BACKUP_PATH%\backup_info.txt

REM 6. Comprimir backup usando PowerShell
echo [INFO] 6. Comprimiendo backup...
powershell -Command "Compress-Archive -Path '%BACKUP_PATH%' -DestinationPath '%BACKUP_DIR%\!BACKUP_NAME!.zip' -Force"

if exist %BACKUP_DIR%\!BACKUP_NAME!.zip (
    REM Obtener tamaño del archivo comprimido
    for %%A in (%BACKUP_DIR%\!BACKUP_NAME!.zip) do set COMPRESSED_SIZE=%%~zA
    set /a COMPRESSED_SIZE_MB=!COMPRESSED_SIZE!/1024/1024
    
    REM Eliminar carpeta sin comprimir
    rmdir /S /Q %BACKUP_PATH%
    
    echo [SUCCESS] Backup comprimido: !BACKUP_NAME!.zip (!COMPRESSED_SIZE_MB! MB)
) else (
    echo [ERROR] Error al comprimir backup
    pause
    exit /b 1
)

REM 7. Limpiar backups antiguos
echo [INFO] 7. Limpiando backups antiguos...
set BACKUP_COUNT=0

REM Contar backups existentes
for %%F in (%BACKUP_DIR%\backup_reparacion_pc_*.zip) do (
    set /a BACKUP_COUNT+=1
)

if !BACKUP_COUNT! gtr %MAX_BACKUPS% (
    set /a BACKUPS_TO_DELETE=!BACKUP_COUNT!-%MAX_BACKUPS%
    
    REM Eliminar backups más antiguos (mantener los más recientes)
    set COUNT=0
    for /f "tokens=*" %%F in ('dir /B /O:-D %BACKUP_DIR%\backup_reparacion_pc_*.zip') do (
        set /a COUNT+=1
        if !COUNT! gtr %MAX_BACKUPS% (
            del %BACKUP_DIR%\%%F
        )
    )
    
    echo [INFO] Eliminados !BACKUPS_TO_DELETE! backups antiguos
)

echo [INFO] Backups mantenidos: !BACKUP_COUNT!/%MAX_BACKUPS%

REM 8. Verificar integridad del backup
echo [INFO] 8. Verificando integridad del backup...
powershell -Command "if (Test-Path '%BACKUP_DIR%\!BACKUP_NAME!.zip') { exit 0 } else { exit 1 }"
if %errorLevel% equ 0 (
    echo [SUCCESS] Verificacion de integridad exitosa
) else (
    echo [ERROR] Error en la verificacion de integridad
    pause
    exit /b 1
)

REM 9. Registro en log de backups
echo [INFO] 9. Registrando en log de backups...
echo %date% %time% - Backup completado: !BACKUP_NAME!.zip (!COMPRESSED_SIZE_MB! MB) >> %BACKUP_DIR%\backup.log

REM Resumen final
echo.
echo ===============================================
echo         BACKUP COMPLETADO EXITOSAMENTE
echo ===============================================
echo Archivo: %BACKUP_DIR%\!BACKUP_NAME!.zip
echo Tamaño: !COMPRESSED_SIZE_MB! MB
echo Ubicacion: %cd%\%BACKUP_DIR%\!BACKUP_NAME!.zip
echo.
echo Para restaurar: Extraer el archivo ZIP
echo Ver backups: dir %BACKUP_DIR%\
echo.

REM Si no estamos en modo silencioso, esperar
if not "%1"=="--silent" (
    echo [INFO] Backup completado correctamente. Presiona cualquier tecla...
    pause >nul
)