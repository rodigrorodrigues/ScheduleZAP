# 🚀 Deploy na VPS - ScheduleZAP

## 📋 Informações da VPS

- **IP**: 89.116.171.102
- **Frontend**: http://89.116.171.102:8988
- **Backend**: http://89.116.171.102:8999

## 🔧 Configurações Ajustadas

### ✅ **Mudanças Realizadas:**

1. **Proxy do Vite**: Alterado para `localhost:8999` (sem referência Docker)
2. **Docker Compose**: Criado `docker-compose.prod.yml` específico para produção
3. **Placeholder**: URL da API atualizada para IP da VPS
4. **Script de Deploy**: Criado `deploy.sh` para facilitar deployment

## 🚀 Como Fazer o Deploy

### **Opção 1: Script Automático**

```bash
# Dar permissão de execução
chmod +x deploy.sh

# Executar deploy
./deploy.sh
```

### **Opção 2: Manual**

```bash
# Parar containers existentes
docker-compose -f docker-compose.prod.yml down

# Construir e iniciar
docker-compose -f docker-compose.prod.yml up -d --build

# Verificar logs
docker-compose -f docker-compose.prod.yml logs -f
```

## 🔍 **Endpoints de Debug**

Após o deploy, você pode usar estes endpoints para debug:

```bash
# Status dos agendamentos
curl http://89.116.171.102:8999/api/debug/schedules-status

# Forçar processamento
curl -X POST http://89.116.171.102:8999/api/debug/process-schedules

# Listar agendamentos
curl http://89.116.171.102:8999/api/schedules
```

## 📊 **Monitoramento**

### **Verificar Status:**

```bash
# Status dos containers
docker-compose -f docker-compose.prod.yml ps

# Logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f

# Logs específicos do backend
docker-compose -f docker-compose.prod.yml logs -f backend
```

### **Logs Importantes:**

- **Processador de mensagens**: Verifica a cada 60s
- **Agendamentos**: Logs detalhados de cada verificação
- **Evolution API**: Logs de requisições e respostas
- **Erros**: Tratamento específico por tipo de erro

## 🔧 **Configuração da Evolution API**

No frontend (http://89.116.171.102:8988):

1. **URL da API**: `http://89.116.171.102:8080` (ou IP da sua Evolution API)
2. **Instância**: Nome da sua instância
3. **Token**: Seu token de autenticação

## 🛠️ **Troubleshooting**

### **Se o agendamento não funcionar:**

1. Verifique os logs: `docker-compose -f docker-compose.prod.yml logs backend`
2. Teste o endpoint de debug: `curl http://89.116.171.102:8999/api/debug/schedules-status`
3. Force o processamento: `curl -X POST http://89.116.171.102:8999/api/debug/process-schedules`

### **Se a Evolution API não responder:**

1. Verifique se está rodando na porta 8080
2. Teste a conectividade: `curl http://89.116.171.102:8080`
3. Verifique se o token está correto

## 📝 **Notas Importantes**

- O backend salva os agendamentos em `./backend/schedules.json`
- O processador verifica agendamentos a cada 60 segundos
- Logs detalhados estão disponíveis para debug
- Healthcheck monitora o backend automaticamente
