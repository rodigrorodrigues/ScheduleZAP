#!/bin/bash

# Script de deploy para VPS
echo "🚀 Iniciando deploy do ScheduleZAP..."

# Parar containers existentes
echo "⏹️ Parando containers existentes..."
docker-compose -f docker-compose.prod.yml down

# Remover imagens antigas
echo "🧹 Removendo imagens antigas..."
docker system prune -f

# Fazer pull das mudanças
echo "📥 Fazendo pull das mudanças..."
git pull origin main

# Build e start dos containers
echo "🔨 Fazendo build dos containers..."
docker-compose -f docker-compose.prod.yml up -d --build

# Aguardar um pouco para o container inicializar
echo "⏳ Aguardando inicialização..."
sleep 10

# Verificar se está funcionando
echo "🔍 Verificando se está funcionando..."
if curl -f http://localhost:8988/health > /dev/null 2>&1; then
    echo "✅ Deploy realizado com sucesso!"
    echo "🌐 Acesse: http://localhost:8988"
else
    echo "❌ Erro no deploy. Verifique os logs:"
    docker-compose -f docker-compose.prod.yml logs
fi 