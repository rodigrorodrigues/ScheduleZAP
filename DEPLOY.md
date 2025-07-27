# 🚀 Guia de Deploy - ScheduleZAP

## 📋 Pré-requisitos

- Docker e Docker Compose instalados
- Porta 8988 disponível
- Acesso ao VPS/ambiente de produção

## 🔧 Deploy

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd ScheduleZAP
```

### 2. Deploy com Docker Compose

```bash
# Parar containers existentes
docker compose down

# Remover volumes antigos (se necessário)
docker compose down -v

# Reconstruir e subir
docker compose up -d --build

# Verificar status
docker compose ps
```

### 3. Verificar logs

```bash
# Logs em tempo real
docker compose logs -f app

# Últimos 20 logs
docker compose logs --tail=20 app
```

### 4. Testar a aplicação

```bash
# Testar conectividade
curl http://localhost:8988

# Testar API
curl http://localhost:8988/api/schedules
```

## 🌐 Acesso

- **Local**: `http://localhost:8988`
- **VPS**: `http://89.116.171.102:8988`

## 📊 Monitoramento

### Healthcheck

O container possui healthcheck automático que verifica se a aplicação está respondendo.

### Logs

Os logs são limitados a 10MB por arquivo, com máximo de 3 arquivos.

### Volumes

- `schedules`: Persistência dos dados de agendamentos

## 🔧 Configuração

### Variáveis de Ambiente

- `NODE_ENV=production`
- `PORT=8988`

### Portas

- **8988**: Aplicação principal

## 🛠️ Troubleshooting

### Container não inicia

```bash
# Verificar logs detalhados
docker compose logs app

# Reconstruir sem cache
docker compose build --no-cache
docker compose up -d
```

### Problemas de permissão

```bash
# Verificar permissões do volume
docker compose exec app ls -la /app/backend
```

### Problemas de rede

```bash
# Verificar se a porta está em uso
netstat -tlnp | grep :8988
```

## 📝 Estrutura do Projeto

```
ScheduleZAP/
├── src/                    # Frontend React
├── backend/               # Backend Node.js
├── dist/                  # Build do frontend
├── server.js              # Servidor unificado
├── Dockerfile             # Build da imagem
├── docker-compose.yml     # Orquestração
└── schedules.json         # Dados persistentes
```

## 🔄 Atualizações

Para atualizar a aplicação:

```bash
# Pull das mudanças
git pull

# Reconstruir e subir
docker compose up -d --build

# Verificar logs
docker compose logs -f app
```

## 🚨 Logs Importantes

- `🚀 Servidor rodando na porta 8988`: Servidor iniciado
- `📁 Arquivo de agendamentos: /app/backend/schedules.json`: Arquivo de dados
- `🔄 Processador de mensagens iniciado`: Processamento ativo
- `✅ Novo agendamento criado`: Agendamento salvo
- `📤 Enviando mensagem`: Envio em andamento
- `✅ Mensagem sent`: Mensagem enviada com sucesso
- `❌ Erro ao enviar mensagem`: Falha no envio

## 📞 Suporte

Em caso de problemas:

1. Verificar logs: `docker compose logs app`
2. Testar conectividade: `curl http://localhost:8988`
3. Verificar status: `docker compose ps`
