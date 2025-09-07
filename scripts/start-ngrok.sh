#!/bin/bash
# Script para iniciar la aplicación con ngrok
# Uso: ./scripts/start-ngrok.sh

set -e

echo "🚀 Iniciando Reparaciones PC con ngrok..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar si ngrok está instalado
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}❌ ngrok no está instalado${NC}"
    echo -e "${YELLOW}Instala ngrok con:${NC}"
    echo "  sudo snap install ngrok"
    echo "  # O descarga desde https://ngrok.com/download"
    exit 1
fi

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js no está instalado${NC}"
    exit 1
fi

# Verificar si las dependencias están instaladas
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Instalando dependencias...${NC}"
    npm install
fi

# Verificar archivo .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No se encontró archivo .env${NC}"
    echo -e "${BLUE}Creando .env básico...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  IMPORTANTE: Edita el archivo .env con tus configuraciones${NC}"
fi

# Crear función para manejar Ctrl+C
cleanup() {
    echo -e "\n${YELLOW}🛑 Deteniendo servicios...${NC}"
    
    # Matar procesos en background
    if [ ! -z "$APP_PID" ]; then
        kill $APP_PID 2>/dev/null || true
    fi
    if [ ! -z "$NGROK_PID" ]; then
        kill $NGROK_PID 2>/dev/null || true
    fi
    if [ ! -z "$MONITOR_PID" ]; then
        kill $MONITOR_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Servicios detenidos${NC}"
    exit 0
}

# Configurar trap para cleanup
trap cleanup SIGINT SIGTERM

echo -e "${BLUE}🔧 Verificando configuración...${NC}"

# Verificar puerto disponible
PORT=${PORT:-3000}
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null; then
    echo -e "${RED}❌ Puerto $PORT ya está en uso${NC}"
    echo "Detén el proceso que usa el puerto $PORT o cambia el puerto en .env"
    exit 1
fi

# Inicializar base de datos si es necesario
if [ ! -f "database/contacts.db" ]; then
    echo -e "${BLUE}🗄️  Inicializando base de datos...${NC}"
    node scripts/setup.js --create-db
fi

echo -e "${GREEN}✅ Configuración verificada${NC}"
echo ""

# Iniciar la aplicación en background
echo -e "${BLUE}🚀 Iniciando aplicación en puerto $PORT...${NC}"
npm start &
APP_PID=$!

# Esperar a que la aplicación esté lista
echo -e "${YELLOW}⏳ Esperando a que la aplicación inicie...${NC}"
sleep 5

# Verificar que la aplicación esté ejecutándose
if ! curl -s http://localhost:$PORT/api/health > /dev/null; then
    echo -e "${RED}❌ Error: La aplicación no responde${NC}"
    cleanup
    exit 1
fi

echo -e "${GREEN}✅ Aplicación iniciada correctamente${NC}"

# Iniciar ngrok en background
echo -e "${BLUE}🌐 Creando túnel público con ngrok...${NC}"
ngrok http $PORT --log=stdout > ngrok.log &
NGROK_PID=$!

# Esperar a que ngrok esté listo
sleep 3

# Obtener URL pública de ngrok
echo -e "${YELLOW}⏳ Obteniendo URL pública...${NC}"
PUBLIC_URL=""
for i in {1..10}; do
    PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)
    if [ ! -z "$PUBLIC_URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$PUBLIC_URL" ]; then
    echo -e "${RED}❌ No se pudo obtener la URL pública de ngrok${NC}"
    cleanup
    exit 1
fi

# Mostrar información de acceso
echo ""
echo -e "${GREEN}🎉 ¡Aplicación desplegada exitosamente!${NC}"
echo ""
echo -e "${BLUE}📱 URLs de acceso:${NC}"
echo -e "   Local:      ${YELLOW}http://localhost:$PORT${NC}"
echo -e "   Público:    ${GREEN}$PUBLIC_URL${NC}"
echo -e "   Admin:      ${GREEN}$PUBLIC_URL/admin.html${NC}"
echo ""
echo -e "${BLUE}🔍 APIs disponibles:${NC}"
echo -e "   Health:     ${YELLOW}$PUBLIC_URL/api/health${NC}"
echo -e "   Keep-alive: ${YELLOW}$PUBLIC_URL/api/webhook/keepalive${NC}"
echo ""
echo -e "${BLUE}🤖 Para n8n/Make.com:${NC}"
echo -e "   Webhook URL: ${GREEN}$PUBLIC_URL/api/webhook/keepalive${NC}"
echo ""

# Iniciar monitor de keep-alive si está disponible
if [ -f "scripts/monitor-keepalive.js" ]; then
    echo -e "${BLUE}🔄 Iniciando monitor keep-alive...${NC}"
    BASE_URL=$PUBLIC_URL node scripts/monitor-keepalive.js &
    MONITOR_PID=$!
    echo -e "${GREEN}✅ Monitor keep-alive iniciado${NC}"
    echo ""
fi

# Mostrar logs en tiempo real
echo -e "${BLUE}📊 Logs en tiempo real (Ctrl+C para detener):${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Seguir logs de la aplicación
tail -f logs/combined-$(date +%Y-%m-%d).log 2>/dev/null || tail -f logs/app.log 2>/dev/null || echo "Logs no disponibles aún..." &
LOG_PID=$!

# Mostrar estadísticas cada 30 segundos
while true; do
    sleep 30
    if kill -0 $APP_PID 2>/dev/null; then
        UPTIME=$(curl -s http://localhost:$PORT/api/health | grep -o '"uptime":[0-9]*' | cut -d':' -f2 || echo "0")
        MEMORY=$(curl -s http://localhost:$PORT/api/health | grep -o '"used":[0-9]*' | cut -d':' -f2 || echo "0")
        echo -e "\n${GREEN}📈 Estado: Activa | Uptime: ${UPTIME}s | Memoria: ${MEMORY}MB${NC}"
    else
        echo -e "\n${RED}💥 La aplicación se detuvo inesperadamente${NC}"
        cleanup
        break
    fi
done

# Esperar indefinidamente (hasta Ctrl+C)
wait