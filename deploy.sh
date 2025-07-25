#!/bin/bash

# Script de Deploy para VPS
# IP: 89.116.171.102

echo "🚀 Iniciando deploy do ScheduleZAP na VPS..."

# Parar containers existentes
echo "🛑 Parando containers existentes..."
docker-compose -f docker-compose.prod.yml down

# Remover containers antigos
echo "🧹 Removendo containers antigos..."
docker container prune -f

# Construir e iniciar containers
echo "🔨 Construindo e iniciando containers..."
docker-compose -f docker-compose.prod.yml up -d --build

# Aguardar inicialização
echo "⏳ Aguardando inicialização dos serviços..."
sleep 30

# Verificar status
echo "📊 Verificando status dos serviços..."
docker-compose -f docker-compose.prod.yml ps

# Testar endpoints
echo "🧪 Testando endpoints..."
curl -s http://localhost:8999/api/schedules || echo "❌ Backend não responde"
curl -s http://localhost:8988 | head -1 || echo "❌ Frontend não responde"

echo "✅ Deploy concluído!"
echo "🌐 Frontend: http://89.116.171.102:8988"
echo "🔧 Backend: http://89.116.171.102:8999"
echo "📋 Logs: docker-compose -f docker-compose.prod.yml logs -f" 