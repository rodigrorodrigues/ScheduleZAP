# ScheduleZAP

Sistema de agendamento de mensagens WhatsApp via Evolution API.

## 🚀 Deploy Rápido

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd ScheduleZAP
```

### 2. Configure a senha (opcional)

Crie um arquivo `.env` na raiz do projeto:

```
VITE_PASSWORD=SuaSenhaAqui
```

### 3. Execute com Docker

```bash
docker-compose up -d
```

### 4. Acesse o sistema

- **Frontend**: http://localhost:8988
- **Backend API**: http://localhost:8999/api/schedules

## 📋 Funcionalidades

- ✅ Login simples com senha
- ✅ Configuração da Evolution API
- ✅ Agendamento de mensagens
- ✅ Listagem e cancelamento de agendamentos
- ✅ Processamento automático 24/7
- ✅ Interface responsiva

## 🔧 Configuração da Evolution API

1. Acesse **Configuração** no menu
2. Preencha:
   - **URL da API**: `http://sua-evolution-api:8080/`
   - **Nome da Instância**: `sua-instancia`
   - **Token**: `seu-token-de-autenticacao`
3. Clique em **Testar Conexão**
4. Se necessário, crie uma nova instância

## 📱 Como Usar

1. **Login**: Digite a senha configurada
2. **Agendar**: Vá em "Agendar Mensagem"
3. **Preencher**:
   - Número do contato (com código do país)
   - Mensagem
   - Data e hora de envio
4. **Confirmar**: Clique em "Agendar"

## 🐳 Docker

### Portas

- **Frontend**: 8988
- **Backend**: 8999

### Volumes

- `./backend/schedules.json` - Persistência dos agendamentos

### Comandos

```bash
# Iniciar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down

# Rebuild
docker-compose up -d --build
```

## 🔍 Troubleshooting

### Backend não responde

```bash
# Verificar se está rodando
docker-compose ps

# Ver logs do backend
docker-compose logs backend

# Testar API diretamente
curl http://localhost:8999/api/schedules
```

### Frontend não carrega

```bash
# Ver logs do frontend
docker-compose logs frontend

# Verificar se o backend está acessível
curl http://localhost:8999/api/schedules
```

### Evolution API não conecta

1. Verifique se a URL está correta
2. Confirme se o token é válido
3. Teste a conexão da Evolution API separadamente
4. Verifique se a instância existe e está conectada

## 📊 Estrutura

```
ScheduleZAP/
├── src/                    # Frontend React
├── backend/               # Backend Node.js
├── docker-compose.yml     # Orquestração Docker
├── Dockerfile            # Build multi-stage
└── README.md            # Este arquivo
```

## 🔐 Segurança

- Senha configurável via variável de ambiente
- Tokens da Evolution API armazenados localmente
- Agendamentos persistidos em arquivo JSON

## 📞 Suporte

Para problemas ou dúvidas, verifique:

1. Logs do Docker: `docker-compose logs`
2. Console do navegador (F12)
3. Configuração da Evolution API
