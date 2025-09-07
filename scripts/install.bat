@echo off
setlocal enabledelayedexpansion

REM Script de instalación para Windows
REM Proyecto: Servicio Reparación PC

echo ===============================================
echo    Instalacion del Sistema de Reparacion PC
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

REM Verificar si Node.js está instalado
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Node.js no está instalado
    echo [INFO] Descargando e instalando Node.js LTS...
    
    REM Descargar Node.js
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.18.2/node-v18.18.2-x64.msi' -OutFile '%temp%\nodejs.msi'"
    
    REM Instalar Node.js
    msiexec /i "%temp%\nodejs.msi" /quiet /norestart
    
    REM Actualizar PATH
    call RefreshEnv.cmd
    
    echo [SUCCESS] Node.js instalado correctamente
) else (
    echo [SUCCESS] Node.js ya está instalado
)

REM Verificar si Git está instalado
git --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Git no está instalado
    echo [INFO] Descargando e instalando Git...
    
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v2.42.0.windows.2/Git-2.42.0.2-64-bit.exe' -OutFile '%temp%\git-installer.exe'"
    
    REM Instalar Git silenciosamente
    "%temp%\git-installer.exe" /VERYSILENT /NORESTART
    
    echo [SUCCESS] Git instalado correctamente
) else (
    echo [SUCCESS] Git ya está instalado
)

REM Crear package.json si no existe
if not exist package.json (
    echo [INFO] Creando package.json...
    
    (
    echo {
    echo   "name": "servicio-reparacion-pc",
    echo   "version": "1.0.0",
    echo   "description": "Sitio web profesional para servicio de reparación de PC",
    echo   "main": "backend/server.js",
    echo   "scripts": {
    echo     "start": "node backend/server.js",
    echo     "dev": "nodemon backend/server.js",
    echo     "install-deps": "npm install",
    echo     "setup-db": "node scripts/setup-database.js",
    echo     "backup": "scripts\\backup.bat",
    echo     "health-check": "curl -f http://localhost:3000/api/health || exit 1"
    echo   },
    echo   "dependencies": {
    echo     "express": "^4.18.2",
    echo     "express-rate-limit": "^7.1.5",
    echo     "helmet": "^7.1.0",
    echo     "cors": "^2.8.5",
    echo     "dotenv": "^16.3.1",
    echo     "sqlite3": "^5.1.6",
    echo     "nodemailer": "^6.9.7",
    echo     "express-validator": "^7.0.1",
    echo     "bcrypt": "^5.1.1",
    echo     "jsonwebtoken": "^9.0.2",
    echo     "morgan": "^1.10.0",
    echo     "compression": "^1.7.4",
    echo     "express-session": "^1.17.3",
    echo     "connect-sqlite3": "^0.9.13",
    echo     "axios": "^1.6.2",
    echo     "node-cron": "^3.0.3"
    echo   },
    echo   "devDependencies": {
    echo     "nodemon": "^3.0.2"
    echo   },
    echo   "keywords": ["reparacion", "pc", "servicio", "local", "argentina"],
    echo   "author": "Servicio Reparación PC",
    echo   "license": "MIT"
    echo }
    ) > package.json
)

REM Crear directorios necesarios
echo [INFO] Creando estructura de directorios...
if not exist backend mkdir backend
if not exist backend\routes mkdir backend\routes
if not exist backend\middleware mkdir backend\middleware
if not exist backend\utils mkdir backend\utils
if not exist backend\config mkdir backend\config
if not exist database mkdir database
if not exist logs mkdir logs
if not exist backups mkdir backups

REM Instalar dependencias de Node.js
echo [INFO] Instalando dependencias de Node.js...
npm install

REM Configurar base de datos SQLite
echo [INFO] Configurando base de datos...
(
echo CREATE TABLE IF NOT EXISTS contacts (
echo     id INTEGER PRIMARY KEY AUTOINCREMENT,
echo     name TEXT NOT NULL,
echo     email TEXT NOT NULL,
echo     phone TEXT NOT NULL,
echo     equipment_type TEXT NOT NULL,
echo     problem_description TEXT NOT NULL,
echo     ip_address TEXT,
echo     user_agent TEXT,
echo     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
echo     status TEXT DEFAULT 'new'
echo );
echo.
echo CREATE TABLE IF NOT EXISTS blocked_ips (
echo     id INTEGER PRIMARY KEY AUTOINCREMENT,
echo     ip_address TEXT UNIQUE NOT NULL,
echo     reason TEXT,
echo     blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
echo );
echo.
echo CREATE TABLE IF NOT EXISTS rate_limits (
echo     id INTEGER PRIMARY KEY AUTOINCREMENT,
echo     ip_address TEXT NOT NULL,
echo     requests_count INTEGER DEFAULT 1,
echo     window_start DATETIME DEFAULT CURRENT_TIMESTAMP
echo );
echo.
echo CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
echo CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);
echo CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip_address);
) | sqlite3 database\contacts.db

REM Crear archivo .env.example si no existe
if not exist .env.example (
    echo [INFO] Creando archivo .env.example...
    
    (
    echo # Configuración del servidor
    echo PORT=3000
    echo NODE_ENV=production
    echo DOMAIN=tu-dominio.com.ar
    echo BASE_URL=https://tu-dominio.com.ar
    echo.
    echo # Base de datos
    echo DB_PATH=./database/contacts.db
    echo.
    echo # Configuración de email (Gmail SMTP^)
    echo EMAIL_HOST=smtp.gmail.com
    echo EMAIL_PORT=587
    echo EMAIL_SECURE=false
    echo EMAIL_USER=tu-email@gmail.com
    echo EMAIL_PASS=tu-app-password
    echo EMAIL_TO=tu-email@gmail.com
    echo.
    echo # reCAPTCHA v3
    echo RECAPTCHA_SITE_KEY=tu-site-key-aqui
    echo RECAPTCHA_SECRET_KEY=tu-secret-key-aqui
    echo.
    echo # Seguridad
    echo JWT_SECRET=tu-jwt-secret-muy-seguro-aqui-minimo-32-caracteres
    echo SESSION_SECRET=tu-session-secret-aqui
    echo.
    echo # Rate limiting
    echo RATE_LIMIT_WINDOW_MS=3600000
    echo RATE_LIMIT_MAX_REQUESTS=3
    echo.
    echo # WhatsApp Business
    echo WHATSAPP_NUMBER=5491112345678
    echo.
    echo # DuckDNS (DNS dinámico^)
    echo DUCKDNS_DOMAIN=tu-subdominio
    echo DUCKDNS_TOKEN=tu-token-duckdns
    echo.
    echo # Configuración SSL
    echo SSL_EMAIL=tu-email@gmail.com
    ) > .env.example
)

REM Configurar Windows Firewall
echo [INFO] Configurando Windows Firewall...
netsh advfirewall firewall add rule name="Reparacion PC HTTP" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="Reparacion PC HTTPS" dir=in action=allow protocol=TCP localport=443
netsh advfirewall firewall add rule name="Reparacion PC Node" dir=in action=allow protocol=TCP localport=3000

REM Instalar como servicio de Windows (usando node-windows)
echo [INFO] Configurando servicio de Windows...
npm install -g node-windows

REM Crear script de servicio
(
echo const Service = require('node-windows'^).Service;
echo const path = require('path'^);
echo.
echo const svc = new Service({
echo   name: 'Servicio Reparacion PC',
echo   description: 'Servidor web para servicio de reparación de PC',
echo   script: path.join(__dirname, '..', 'backend', 'server.js'^),
echo   env: {
echo     name: 'NODE_ENV',
echo     value: 'production'
echo   }
echo }^);
echo.
echo svc.on('install', function(^){
echo   console.log('Servicio instalado correctamente'^);
echo   svc.start(^);
echo }^);
echo.
echo svc.install(^);
) > scripts\install-service.js

node scripts\install-service.js

REM Crear tarea programada para DuckDNS
echo [INFO] Configurando actualización automática de DNS...
(
echo @echo off
echo setlocal
echo for /f "delims=" %%%%i in (.env^) do (
echo   for /f "tokens=1,2 delims==" %%%%a in ("%%%%i"^) do (
echo     if "%%%%a"=="DUCKDNS_DOMAIN" set DUCKDNS_DOMAIN=%%%%b
echo     if "%%%%a"=="DUCKDNS_TOKEN" set DUCKDNS_TOKEN=%%%%b
echo   ^)
echo ^)
echo curl "https://www.duckdns.org/update?domains=%%DUCKDNS_DOMAIN%%&token=%%DUCKDNS_TOKEN%%&ip="
) > scripts\update-duckdns.bat

REM Programar tarea cada 5 minutos
schtasks /create /sc minute /mo 5 /tn "DuckDNS Update" /tr "%cd%\scripts\update-duckdns.bat" /f

echo.
echo ===============================================
echo         INSTALACION COMPLETADA
echo ===============================================
echo.
echo Proximos pasos:
echo 1. Copia .env.example a .env y configura las variables
echo 2. Configura tu router para port forwarding (puerto 80 y 443^)
echo 3. Ejecuta 'scripts\start.bat' para iniciar el servidor
echo.
echo IMPORTANTE:
echo - Configura las variables en el archivo .env antes de continuar
echo - Asegurate de que el dominio apunte a tu IP publica
echo - El router debe tener port forwarding configurado
echo.
echo Para obtener ayuda, consulta docs\SETUP.md
echo.
pause