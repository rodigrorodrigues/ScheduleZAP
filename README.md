# ScheduleZAP - Agendador de Mensagens WhatsApp

Um aplicativo web simples para agendar mensagens do WhatsApp usando a Evolution API.

## 🚀 Funcionalidades

- **Agendar Mensagens**: Agende mensagens para qualquer data e hora
- **Mensagens Agendadas**: Visualize e gerencie todas as mensagens agendadas
- **Configuração**: Configure a URL da Evolution API, token e nome da instância
- **Interface Moderna**: Interface responsiva e intuitiva
- **Status em Tempo Real**: Acompanhe o status de envio das mensagens
- **Autenticação Segura**: Login com usuário e senha
- **Persistência de Dados**: Banco SQLite para dados permanentes
- **PWA (Progressive Web App)**: Instalável como app nativo
- **Responsividade Mobile**: Interface otimizada para dispositivos móveis

## 📋 Pré-requisitos

- Docker e Docker Compose instalados
- Evolution API configurada e rodando
- API Key da Evolution API

## 🛠️ Instalação

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd ScheduleZAP
```

### 2. Configure a Evolution API

Primeiro, você precisa ter a Evolution API rodando. Siga as instruções em:
https://github.com/EvolutionAPI/evolution-api

### 3. Execute com Docker Compose

```bash
docker-compose up --build -d
```

### 4. Acesse a aplicação

Abra seu navegador e acesse: `http://localhost:8988`

## ⚙️ Configuração

1. Acesse a seção "Configuração" no menu lateral
2. Preencha os campos:
   - **URL da Evolution API**: URL onde sua Evolution API está rodando (ex: http://localhost:8080)
   - **API Key**: API Key obtida da Evolution API
   - **Nome da Instância**: Nome da instância configurada na Evolution API
3. Clique em "Salvar Configuração"

## 📱 Como Usar

### Agendar uma Mensagem

1. Vá para a seção "Agendar"
2. Preencha os campos:
   - **Número do WhatsApp**: Digite apenas números (ex: 5511999999999)
   - **Data e Hora**: Selecione quando a mensagem deve ser enviada
   - **Mensagem**: Digite o texto da mensagem
3. Clique em "Agendar Mensagem"

### Visualizar Mensagens Agendadas

1. Vá para a seção "Mensagens Agendadas"
2. Visualize todas as mensagens agendadas com seus respectivos status
3. Use o botão de lixeira para remover mensagens

## 🔧 Estrutura do Projeto

```
ScheduleZAP/
├── server.js              # Servidor Express
├── package.json           # Dependências Node.js
├── Dockerfile            # Configuração Docker
├── docker-compose.yml    # Orquestração Docker
├── public/               # Frontend
│   ├── index.html        # Página principal
│   └── app.js           # JavaScript do frontend
└── README.md            # Este arquivo
```

## 🌐 API Endpoints

### Mensagens

- `GET /api/messages` - Listar mensagens agendadas
- `POST /api/messages` - Agendar nova mensagem
- `DELETE /api/messages/:id` - Remover mensagem

### Configuração

- `GET /api/config` - Obter configurações
- `POST /api/config` - Salvar configurações

## 🔒 Segurança

- As configurações são salvas localmente no arquivo `config.json`
- O token da Evolution API é armazenado de forma segura
- Validação de entrada em todos os formulários

## 🐛 Solução de Problemas

### Mensagens não são enviadas

#### Erro 401 (Não Autorizado)

- **Problema**: API Key inválida ou não autorizada
- **Solução**:
  1. Verifique se a API Key da Evolution API está correta
  2. Confirme se a API Key tem permissões para enviar mensagens
  3. Use o botão "Testar Conexão" na seção Configuração

#### Erro 404 (Não Encontrado)

- **Problema**: Instância não encontrada
- **Solução**:
  1. Verifique se o nome da instância está correto
  2. Confirme se a instância foi criada na Evolution API
  3. Verifique se a instância está conectada ao WhatsApp

#### Erro de Conexão

- **Problema**: Não foi possível conectar à Evolution API
- **Solução**:
  1. Verifique se a Evolution API está rodando
  2. Confirme se a URL está correta (ex: http://localhost:8080)
  3. Verifique se a porta está acessível
  4. Teste a conectividade: `curl http://sua-evolution-api:porta`

### Verificação de Configuração

1. **Acesse a seção Configuração**
2. **Preencha os campos**:
   - URL da Evolution API (ex: http://localhost:8080)
   - API Key (obtida da Evolution API)
   - Nome da instância (ex: default)
3. **Clique em "Salvar Configuração"**
4. **Clique em "Testar Conexão"** para verificar se está funcionando

### Logs Detalhados

Para ver logs detalhados:

```bash
# Docker
docker-compose logs -f schedulezap

# Local
npm start
```

Os logs mostrarão:

- Tentativas de envio de mensagens
- URLs sendo chamadas
- Erros detalhados da Evolution API
- Status de conectividade

## 📝 Logs

Para visualizar os logs da aplicação:

```bash
docker-compose logs -f schedulezap
```

## 🔄 Atualizações

Para atualizar a aplicação:

```bash
git pull
docker-compose down
docker-compose up --build -d
```

## 📄 Licença

Este projeto está sob a licença MIT.

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

---

**Desenvolvido com ❤️ para facilitar o agendamento de mensagens do WhatsApp**
