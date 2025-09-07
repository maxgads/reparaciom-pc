@echo off
setlocal enabledelayedexpansion

REM Script para iniciar el servidor de reparación PC en Windows
REM Incluye verificaciones de salud y monitoreo

echo ===============================================
echo    Iniciando Sistema de Reparacion PC
echo ===============================================
echo.

REM Verificar permisos de administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Este script requiere permisos de administrador
    echo Por favor, ejecuta como administrador
    pause
    exit /b 1
)

REM Verificar archivo .env
if not exist .env (
    echo [ERROR] Archivo .env no encontrado
    echo [INFO] Copia .env.example a .env y configura las variables
    pause
    exit /b 1
)

REM Cargar variables de entorno desde .env
for /f "delims=" %%i in (.env) do (
    for /f "tokens=1,2 delims==" %%a in ("%%i") do (
        set %%a=%%b
    )
)

REM Verificar variables críticas
if "%PORT%"=="" (
    echo [ERROR] Variable PORT no configurada
    pause
    exit /b 1
)

if "%DOMAIN%"=="" (
    echo [ERROR] Variable DOMAIN no configurada
    pause
    exit /b 1
)

if "%EMAIL_USER%"=="" (
    echo [ERROR] Variable EMAIL_USER no configurada
    pause
    exit /b 1
)

echo [SUCCESS] Archivo .env configurado correctamente

REM Verificar dependencias de Node.js
if not exist node_modules (
    echo [WARNING] Dependencias no instaladas, instalando...
    npm install
)

REM Verificar base de datos
echo [INFO] Verificando base de datos...
if not exist database\contacts.db (
    echo [WARNING] Base de datos no encontrada, creando...
    if not exist database mkdir database
    sqlite3 database\contacts.db < database\schema.sql 2>nul
)

REM Crear directorio de logs
if not exist logs mkdir logs

REM Detener servicio existente si está corriendo
echo [INFO] Deteniendo servicio existente...
sc stop "Servicio Reparacion PC" >nul 2>&1

REM Verificar si el puerto está en uso
echo [INFO] Verificando puertos...
netstat -an | find ":%PORT%" >nul
if %errorLevel% equ 0 (
    echo [WARNING] Puerto %PORT% ya está en uso
    echo [INFO] Intentando detener proceso...
    for /f "tokens=5" %%a in ('netstat -ano ^| find ":%PORT%"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Actualizar DNS dinámico
echo [INFO] Actualizando DNS dinámico...
if exist scripts\update-duckdns.bat (
    call scripts\update-duckdns.bat
    echo [SUCCESS] DNS dinámico actualizado
)

REM Iniciar servicio de Windows
echo [INFO] Iniciando servicio de Windows...
sc start "Servicio Reparacion PC" >nul 2>&1

REM Esperar a que el servicio inicie
timeout /t 5 /nobreak >nul

REM Verificar estado del servicio
sc query "Servicio Reparacion PC" | find "RUNNING" >nul
if %errorLevel% equ 0 (
    echo [SUCCESS] Servicio iniciado correctamente
) else (
    echo [ERROR] Error al iniciar el servicio
    sc query "Servicio Reparacion PC"
    pause
    exit /b 1
)

REM Health check de la aplicación
echo [INFO] Ejecutando health check...
set /a attempts=0
set max_attempts=30

:health_check_loop
curl -f -s http://localhost:%PORT%/api/health >nul 2>&1
if %errorLevel% equ 0 (
    echo [SUCCESS] Servidor respondiendo correctamente
    goto health_check_success
)

set /a attempts+=1
if %attempts% geq %max_attempts% (
    echo [ERROR] El servidor no responde después de %max_attempts% intentos
    pause
    exit /b 1
)

echo [INFO] Esperando respuesta del servidor... (intento %attempts%/%max_attempts%)
timeout /t 2 /nobreak >nul
goto health_check_loop

:health_check_success

REM Verificar puertos
echo [INFO] Verificando puertos...
netstat -an | find ":80 " >nul && echo [SUCCESS] Puerto 80 está en uso || echo [WARNING] Puerto 80 no está en uso
netstat -an | find ":443 " >nul && echo [SUCCESS] Puerto 443 está en uso || echo [WARNING] Puerto 443 no está en uso
netstat -an | find ":%PORT% " >nul && echo [SUCCESS] Puerto %PORT% está en uso || echo [WARNING] Puerto %PORT% no está en uso

REM Mostrar información del sistema
echo.
echo ===============================================
echo           INFORMACION DEL SISTEMA
echo ===============================================
echo Dominio: %DOMAIN%
echo Email: %EMAIL_USER%
echo WhatsApp: %WHATSAPP_NUMBER%
echo Puerto interno: %PORT%
echo Estado: Funcionando
echo.

REM Mostrar URLs de acceso
echo ===============================================
echo         SISTEMA INICIADO CORRECTAMENTE
echo ===============================================
echo.
echo URLs de acceso:
echo   Sitio web: https://%DOMAIN%
echo   Panel de salud: https://%DOMAIN%/api/health
echo   Local: http://localhost:%PORT%
echo.
echo Para detener el sistema: sc stop "Servicio Reparacion PC"
echo Para ver el estado: sc query "Servicio Reparacion PC"
echo.

REM Crear archivo de estado
(
echo STARTED_AT=%date% %time%
echo DOMAIN=%DOMAIN%
echo PORT=%PORT%
echo STATUS=RUNNING
) > .server-status

echo [SUCCESS] Sistema de Reparacion PC iniciado exitosamente!
echo.

REM Abrir navegador web (opcional)
set /p open_browser="¿Abrir el sitio web en el navegador? (s/n): "
if /i "%open_browser%"=="s" (
    start http://localhost:%PORT%
)

pause