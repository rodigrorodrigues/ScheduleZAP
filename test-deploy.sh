#!/bin/bash

echo "🧪 Testando deploy do ScheduleZAP..."

# Verificar se o container está rodando
echo "📊 Status do container:"
docker compose ps

# Verificar logs
echo "📋 Logs do container:"
docker compose logs --tail=20 app

# Testar se a aplicação está respondendo
echo "🌐 Testando conectividade:"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8988

# Testar API
echo "🔌 Testando API:"
curl -s http://localhost:8988/api/schedules

echo "✅ Teste concluído!" 