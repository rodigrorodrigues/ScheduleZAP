# ScheduleZAP

Agendador de mensagens WhatsApp via Evolution API.

## Como usar

### Instalação local

1. Clone o projeto e entre na pasta:

```bash
git clone <url-do-repositorio>
cd ScheduleZAP
```

2. Instale as dependências:

```bash
npm install
cd backend && npm install && cd ..
```

3. Inicie o projeto:

```bash
npm run dev
```

Acesse http://localhost:3000

### Com Docker

```bash
docker-compose up -d
```

Acesse http://localhost:8988

## Configuração

### Evolution API

1. Vá em **Configurações**
2. Preencha:
   - URL da API (ex: https://evo.seusite.dev.br)
   - Nome da instância
   - Token de autenticação
3. Clique em **Conectar Instância**
4. Teste o envio de mensagem

### Senha de acesso

A senha padrão é `S3nha!2024@zap`.

Para trocar, crie um arquivo `.env` na raiz:

```
VITE_PASSWORD=sua-nova-senha
```

## Funcionalidades

- Login simples (só senha)
- Agendar mensagens para qualquer data/hora
- Ver todos os agendamentos
- Cancelar agendamentos pendentes
- Backend roda 24h (envia mensagens mesmo com navegador fechado)

## Deploy no EasyPanel

### Configuração

- Tipo: Docker Compose
- Porta principal: 8988
- Porta secundária: 8999

### Variáveis de ambiente

Configure no EasyPanel:

```
VITE_PASSWORD=sua-senha
NODE_ENV=production
```

### Problemas comuns

**Container não inicia:**

- Verifique se as portas 8988 e 8999 estão livres
- Confirme se o docker-compose.yml está na raiz

**Frontend não carrega:**

- Acesse http://seu-dominio:8988
- Verifique se o container está rodando

**Backend não responde:**

- Teste http://seu-dominio:8999/api/schedules
- Verifique a configuração da Evolution API

**Mensagens não enviam:**

- Teste a conexão nas configurações
- Confirme se a instância está conectada

### Logs importantes

O container mostra logs detalhados:

- "Iniciando ScheduleZAP..." - Sistema iniciando
- "Frontend rodando..." - Frontend pronto
- "API backend rodando..." - Backend pronto
- "Processando agendamentos..." - Processamento automático
- "Enviando para Evolution API..." - Tentativa de envio

## Estrutura

```
ScheduleZAP/
├── src/                    # Frontend
├── backend/               # Backend
├── docker-entrypoint.js   # Servidor unificado
├── Dockerfile            # Container
├── docker-compose.yml    # Orquestração
└── README.md            # Este arquivo
```
