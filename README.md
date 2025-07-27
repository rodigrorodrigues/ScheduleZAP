# ScheduleZAP

Agendador de mensagens WhatsApp via Evolution API v2

## 🚀 Funcionalidades

- ✅ Agendamento de mensagens WhatsApp
- ✅ Interface web moderna e responsiva
- ✅ Integração com Evolution API v2
- ✅ Processamento automático de mensagens
- ✅ Histórico de mensagens agendadas
- ✅ Configuração de instâncias
- ✅ Autenticação simples
- ✅ Deploy via Docker Compose

## 🛠️ Tecnologias

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **API**: Evolution API v2
- **Deploy**: Docker + Docker Compose

## 📋 Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- Evolution API v2 configurada

## 🚀 Deploy na VPS

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd ScheduleZAP
```

### 2. Configure as variáveis de ambiente (opcional)

```bash
# Crie um arquivo .env se necessário
echo "VITE_PASSWORD=sua_senha_aqui" > .env
```

### 3. Deploy com Docker Compose

```bash
# Deploy em produção
docker-compose -f docker-compose.prod.yml up -d --build

# Ou use o script de deploy
chmod +x deploy.sh
./deploy.sh
```

### 4. Acesse a aplicação

```
http://seu-ip:8988
```

## 🔧 Desenvolvimento Local

### 1. Instalar dependências

```bash
npm install
cd backend && npm install
```

### 2. Configurar Evolution API

- Acesse: http://localhost:8988/settings
- Configure a URL da API, instância e token

### 3. Executar em desenvolvimento

```bash
npm run dev
```

## 📁 Estrutura do Projeto

```
ScheduleZAP/
├── src/                    # Frontend React
│   ├── components/         # Componentes reutilizáveis
│   ├── contexts/          # Contextos React
│   ├── pages/             # Páginas da aplicação
│   └── services/          # Serviços de API
├── backend/               # Backend Node.js
│   ├── index.js          # Servidor Express
│   └── schedules.json    # Arquivo de agendamentos
├── docker-compose.yml    # Configuração Docker
├── Dockerfile            # Build da aplicação
└── deploy.sh            # Script de deploy
```

## 🔐 Configuração da Evolution API

1. **URL da API**: URL da sua Evolution API (ex: http://seu-ip:8080)
2. **Nome da Instância**: Nome da instância WhatsApp
3. **Token**: Token de autenticação da Evolution API

### Criando uma nova instância:

1. Acesse as configurações
2. Clique em "Listar Instâncias"
3. Clique em "Criar Nova Instância"
4. Escaneie o QR Code com o WhatsApp

## 📝 Uso

### Agendar uma mensagem:

1. Acesse: `/schedule`
2. Digite o número do WhatsApp (com DDD e código do país)
3. Escreva a mensagem
4. Selecione data e horário
5. Clique em "Agendar"

### Ver mensagens agendadas:

1. Acesse: `/` (página inicial)
2. Veja todas as mensagens agendadas
3. Cancele mensagens pendentes se necessário

## 🔍 Troubleshooting

### Problemas comuns:

1. **Evolution API não conecta**

   - Verifique se a URL está correta
   - Confirme se o token é válido
   - Teste a conexão nas configurações

2. **Mensagens não são enviadas**

   - Verifique se a instância está conectada
   - Confirme se o número está no formato correto
   - Veja os logs do backend

3. **Erro no deploy**
   - Verifique se a porta 8988 está livre
   - Confirme se o Docker está rodando
   - Veja os logs: `docker-compose logs`

## 📊 Logs

### Ver logs do container:

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Ver logs específicos:

```bash
docker-compose -f docker-compose.prod.yml logs app
```

## 🔄 Atualizações

Para atualizar a aplicação:

```bash
# Parar containers
docker-compose -f docker-compose.prod.yml down

# Fazer pull das mudanças
git pull origin main

# Rebuild e start
docker-compose -f docker-compose.prod.yml up -d --build
```

## 📞 Suporte

Para suporte ou dúvidas:

- Verifique os logs do container
- Teste a conectividade com a Evolution API
- Confirme as configurações nas configurações da aplicação

## 📄 Licença

Este projeto é de uso livre para fins educacionais e comerciais.
