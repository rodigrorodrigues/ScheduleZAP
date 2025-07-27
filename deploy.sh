#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configurações
VPS_IP="89.116.171.102"
PROJECT_PATH="/etc/easypanel/projects/evolution/schedulezap/code"

echo -e "${YELLOW}🚀 Iniciando deploy para VPS ($VPS_IP)...${NC}"

# Buildar o projeto localmente
echo -e "${YELLOW}📦 Buildando o projeto...${NC}"
npm run build

# Criar arquivo de deploy com apenas os arquivos necessários
echo -e "${YELLOW}📝 Criando arquivo de deploy...${NC}"
tar czf deploy.tar.gz \
    dist/ \
    backend/ \
    docker-compose.yml \
    Dockerfile \
    docker-entrypoint.js \
    package.json \
    package-lock.json

# Enviar para a VPS
echo -e "${YELLOW}📤 Enviando arquivos para a VPS...${NC}"
scp deploy.tar.gz root@$VPS_IP:$PROJECT_PATH/

# Executar comandos remotamente
echo -e "${YELLOW}🔧 Executando comandos na VPS...${NC}"
ssh root@$VPS_IP "cd $PROJECT_PATH && \
    echo '📦 Extraindo arquivos...' && \
    tar xzf deploy.tar.gz && \
    rm deploy.tar.gz && \
    echo '🛑 Parando contêineres...' && \
    docker compose down && \
    echo '🏗️ Reconstruindo contêineres...' && \
    docker compose up -d --build && \
    echo '📋 Logs do contêiner:' && \
    docker compose logs -f --tail=100"

# Limpar arquivos locais
echo -e "${YELLOW}🧹 Limpando arquivos temporários...${NC}"
rm deploy.tar.gz

echo -e "${GREEN}✅ Deploy concluído!${NC}"
echo -e "${GREEN}🌐 A aplicação estará disponível em:${NC}"
echo -e "${GREEN}   https://evolution-schedulezap.jqzthr.easypanel.host${NC}" 