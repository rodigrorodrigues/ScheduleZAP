# 🚀 Deploy na VPS - ScheduleZAP

## 📋 Pré-requisitos

- VPS com Docker e Docker Compose instalados
- Porta 8988 liberada no firewall
- Evolution API v2 configurada e rodando

## 🔧 Passo a Passo

### 1. Conectar na VPS

```bash
ssh root@seu-ip-da-vps
```

### 2. Clonar o repositório

```bash
git clone <seu-repositorio>
cd ScheduleZAP
```

### 3. Configurar variáveis de ambiente (opcional)

```bash
# Criar arquivo .env se necessário
echo "VITE_PASSWORD=sua_senha_aqui" > .env
```

### 4. Deploy inicial

```bash
# Dar permissão ao script de deploy
chmod +x deploy.sh

# Executar deploy
./deploy.sh
```

### 5. Verificar se está funcionando

```bash
# Verificar se o container está rodando
docker ps

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# Testar health check
curl http://localhost:8988/health
```

## 🔄 Atualizações

### Atualizar a aplicação:

```bash
# Parar containers
docker-compose -f docker-compose.prod.yml down

# Fazer pull das mudanças
git pull origin main

# Rebuild e start
docker-compose -f docker-compose.prod.yml up -d --build
```

### Ou usar o script:

```bash
./deploy.sh
```

## 📊 Monitoramento

### Ver logs em tempo real:

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Ver logs específicos:

```bash
docker-compose -f docker-compose.prod.yml logs app
```

### Verificar status:

```bash
docker-compose -f docker-compose.prod.yml ps
```

## 🔍 Troubleshooting

### Container não inicia:

```bash
# Ver logs detalhados
docker-compose -f docker-compose.prod.yml logs app

# Verificar se a porta está livre
netstat -tulpn | grep 8988

# Reiniciar container
docker-compose -f docker-compose.prod.yml restart
```

### Problemas de conectividade:

```bash
# Testar se a aplicação responde
curl http://localhost:8988/health

# Verificar firewall
ufw status

# Liberar porta se necessário
ufw allow 8988
```

### Problemas de disco:

```bash
# Verificar espaço em disco
df -h

# Limpar imagens Docker não utilizadas
docker system prune -f
```

## 🔐 Configuração da Evolution API

1. Acesse: `http://seu-ip:8988/settings`
2. Configure:
   - **URL da API**: `http://ip-da-evolution-api:8080`
   - **Nome da Instância**: Nome da sua instância
   - **Token**: Token de autenticação

## 📝 Comandos Úteis

```bash
# Parar aplicação
docker-compose -f docker-compose.prod.yml down

# Iniciar aplicação
docker-compose -f docker-compose.prod.yml up -d

# Rebuild completo
docker-compose -f docker-compose.prod.yml up -d --build

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# Backup dos dados
docker cp schedulezap_app_1:/app/backend/schedules.json ./backup_schedules.json

# Restaurar dados
docker cp ./backup_schedules.json schedulezap_app_1:/app/backend/schedules.json
```

## 🌐 Acesso

- **URL da aplicação**: `http://seu-ip:8988`
- **Senha padrão**: `S3nha!2024@zap` (configurável via .env)

## 📞 Suporte

Em caso de problemas:

1. Verifique os logs: `docker-compose -f docker-compose.prod.yml logs`
2. Teste a conectividade: `curl http://localhost:8988/health`
3. Verifique se a Evolution API está funcionando
4. Confirme as configurações na interface web
