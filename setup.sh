#!/bin/bash

# Script de inicialização completa do projeto UniVision Brasil

echo "🎬 Iniciando UniVision Brasil..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para verificar se comando existe
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Verificar pré-requisitos
echo -e "${BLUE}📋 Verificando pré-requisitos...${NC}"

if ! command_exists node; then
  echo -e "${RED}❌ Node.js não encontrado. Instale Node.js >= 18.0.0${NC}"
  exit 1
fi

if ! command_exists npm; then
  echo -e "${RED}❌ npm não encontrado.${NC}"
  exit 1
fi

if ! command_exists docker; then
  echo -e "${YELLOW}⚠️  Docker não encontrado. Continuando sem Docker...${NC}"
  USE_DOCKER=false
else
  USE_DOCKER=true
fi

echo -e "${GREEN}✅ Pré-requisitos verificados${NC}"
echo ""

# Perguntar ao usuário o método de instalação
echo -e "${BLUE}Escolha o método de instalação:${NC}"
echo "1) Docker (Recomendado - inclui MongoDB e Redis)"
echo "2) Manual (requer MongoDB e Redis instalados)"
read -p "Escolha (1 ou 2): " choice

if [ "$choice" = "1" ] && [ "$USE_DOCKER" = true ]; then
  echo ""
  echo -e "${BLUE}🐳 Usando Docker Compose...${NC}"
  
  # Verificar se docker-compose existe
  if ! command_exists docker-compose; then
    echo -e "${RED}❌ docker-compose não encontrado.${NC}"
    exit 1
  fi
  
  # Copiar .env.example para .env se não existir
  if [ ! -f backend/.env ]; then
    echo -e "${YELLOW}📝 Criando arquivo .env...${NC}"
    cp backend/.env.example backend/.env
    echo -e "${GREEN}✅ Arquivo .env criado. Edite-o se necessário.${NC}"
  fi
  
  # Build e start com docker-compose
  echo -e "${BLUE}🔨 Building containers...${NC}"
  docker-compose build
  
  echo ""
  echo -e "${BLUE}🚀 Iniciando serviços...${NC}"
  docker-compose up -d
  
  echo ""
  echo -e "${GREEN}✅ Serviços iniciados!${NC}"
  echo ""
  echo -e "${BLUE}📡 URLs disponíveis:${NC}"
  echo "   Web App: http://localhost:80"
  echo "   API:     http://localhost:3000"
  echo "   Health:  http://localhost:3000/health"
  echo ""
  echo -e "${YELLOW}💡 Comandos úteis:${NC}"
  echo "   Ver logs:   docker-compose logs -f"
  echo "   Parar:      docker-compose down"
  echo "   Reiniciar:  docker-compose restart"
  
else
  echo ""
  echo -e "${BLUE}📦 Instalação Manual...${NC}"
  
  # Verificar MongoDB
  if ! command_exists mongod && ! command_exists mongo; then
    echo -e "${RED}❌ MongoDB não encontrado. Instale MongoDB >= 7.0${NC}"
    exit 1
  fi
  
  # Verificar Redis
  if ! command_exists redis-server && ! command_exists redis-cli; then
    echo -e "${RED}❌ Redis não encontrado. Instale Redis >= 7.0${NC}"
    exit 1
  fi
  
  # Instalar dependências do backend
  echo ""
  echo -e "${BLUE}📦 Instalando dependências do backend...${NC}"
  cd backend
  npm install
  
  # Copiar .env
  if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}📝 Arquivo .env criado. Configure-o antes de iniciar.${NC}"
  fi
  
  cd ..
  
  # Instalar dependências do web-app
  echo ""
  echo -e "${BLUE}📦 Instalando dependências do web-app...${NC}"
  cd web-app
  npm install
  cd ..
  
  echo ""
  echo -e "${GREEN}✅ Instalação concluída!${NC}"
  echo ""
  echo -e "${YELLOW}⚠️  Antes de iniciar:${NC}"
  echo "   1. Configure backend/.env com suas credenciais"
  echo "   2. Inicie MongoDB: mongod"
  echo "   3. Inicie Redis: redis-server"
  echo ""
  echo -e "${BLUE}🚀 Para iniciar os serviços:${NC}"
  echo ""
  echo "   Backend (terminal 1):"
  echo "   cd backend && npm run dev"
  echo ""
  echo "   Web App (terminal 2):"
  echo "   cd web-app && npm run dev"
  echo ""
  echo -e "${BLUE}📡 URLs disponíveis:${NC}"
  echo "   Web App: http://localhost:3001"
  echo "   API:     http://localhost:3000"
  echo "   Health:  http://localhost:3000/health"
fi

echo ""
echo -e "${GREEN}🎉 Setup completo!${NC}"
echo ""
