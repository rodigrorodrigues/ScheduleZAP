#!/bin/bash

# Script para testar Evolution API
# IP da VPS: 89.116.171.102

echo "🧪 Testando Evolution API..."

# Configurações (ajuste conforme necessário)
API_URL="http://89.116.171.102:8080"
INSTANCE="sua-instancia"
TOKEN="seu-token"
NUMBER="5519994466218"
MESSAGE="Teste automático do ScheduleZAP"

echo "📋 Configurações:"
echo "   API URL: $API_URL"
echo "   Instância: $INSTANCE"
echo "   Número: $NUMBER"
echo "   Mensagem: $MESSAGE"
echo ""

# Teste 1: Verificar se o backend está rodando
echo "🔍 Teste 1: Verificando backend..."
curl -s http://89.116.171.102:8999/api/schedules > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Backend está respondendo"
else
    echo "❌ Backend não está respondendo"
    exit 1
fi

# Teste 2: Verificar status dos agendamentos
echo "🔍 Teste 2: Status dos agendamentos..."
curl -s http://89.116.171.102:8999/api/debug/schedules-status | jq '.'

# Teste 3: Testar conectividade com Evolution API
echo "🔍 Teste 3: Testando Evolution API..."
curl -X POST http://89.116.171.102:8999/api/debug/test-evolution \
  -H "Content-Type: application/json" \
  -d "{
    \"apiUrl\": \"$API_URL\",
    \"instance\": \"$INSTANCE\",
    \"token\": \"$TOKEN\",
    \"number\": \"$NUMBER\",
    \"message\": \"$MESSAGE\"
  }" | jq '.'

# Teste 4: Forçar processamento
echo "🔍 Teste 4: Forçando processamento..."
curl -X POST http://89.116.171.102:8999/api/debug/process-schedules | jq '.'

echo ""
echo "✅ Testes concluídos!"
echo "📋 Para ver logs detalhados:"
echo "   docker-compose -f docker-compose.prod.yml logs -f backend" 