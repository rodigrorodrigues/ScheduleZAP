#!/bin/bash

echo "🧪 Testando deploy do ScheduleZAP..."

# Verificar se o Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não está instalado"
    exit 1
fi

echo "✅ Docker e Docker Compose encontrados"

# Parar containers existentes
echo "⏹️ Parando containers existentes..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null

# Build da aplicação
echo "🔨 Fazendo build da aplicação..."
docker-compose -f docker-compose.prod.yml build

if [ $? -ne 0 ]; then
    echo "❌ Erro no build da aplicação"
    exit 1
fi

echo "✅ Build realizado com sucesso"

# Iniciar containers
echo "🚀 Iniciando containers..."
docker-compose -f docker-compose.prod.yml up -d

if [ $? -ne 0 ]; then
    echo "❌ Erro ao iniciar containers"
    exit 1
fi

echo "✅ Containers iniciados"

# Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 15

# Testar health check
echo "🔍 Testando health check..."
if curl -f http://localhost:8988/health > /dev/null 2>&1; then
    echo "✅ Health check passou"
else
    echo "❌ Health check falhou"
    echo "📋 Logs do container:"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi

# Testar página principal
echo "🌐 Testando página principal..."
if curl -f http://localhost:8988 > /dev/null 2>&1; then
    echo "✅ Página principal carregou"
else
    echo "❌ Página principal não carregou"
    exit 1
fi

echo ""
echo "🎉 Deploy testado com sucesso!"
echo "🌐 Acesse: http://localhost:8988"
echo "🔍 Health check: http://localhost:8988/health"
echo ""
echo "📋 Para ver logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "🛑 Para parar: docker-compose -f docker-compose.prod.yml down" 