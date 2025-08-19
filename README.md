# ScheduleZAP v2 - Agendador de Mensagens WhatsApp

Um aplicativo web para agendar mensagens do WhatsApp usando a Evolution API, com suporte a múltiplas instâncias por usuário.

## 🚀 Funcionalidades

- **Múltiplas Instâncias**: Cada usuário pode gerenciar suas próprias instâncias da Evolution API
- **Agendar Mensagens**: Agende mensagens para qualquer data e hora
- **Mensagens Agendadas**: Visualize e gerencie todas as mensagens agendadas
- **Gerenciamento de Instâncias**: Crie, edite, exclua e ative instâncias
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

1. Faça login com o usuário padrão (admin / Lucas4tlof!)
2. Acesse a seção "Instâncias" no menu lateral
3. Clique em "Nova Instância"
4. Preencha os campos:
   - **Nome**: Nome para identificar a instância
   - **URL da Evolution API**: URL onde sua Evolution API está rodando (ex: http://localhost:8080)
   - **API Key**: API Key obtida da Evolution API
   - **Nome da Instância**: Nome da instância configurada na Evolution API
5. Clique em "Salvar Instância"
6. Ative a instância clicando no botão "Ativar"

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

### Gerenciar Instâncias

1. Vá para a seção "Instâncias"
2. Visualize todas as suas instâncias
3. Use os botões para:
   - Criar nova instância
   - Editar instância existente
   - Excluir instância
   - Ativar/desativar instância

## 🔧 Estrutura do Projeto

```
ScheduleZAP/
├── server.js              # Servidor Express
├── database.js           # Funções do banco de dados
├── package.json          # Dependências Node.js
├── Dockerfile           # Configuração Docker
├── docker-compose.yml   # Orquestração Docker
├── public/              # Frontend
│   ├── index.html       # Página principal
│   ├── login.html      # Página de login
│   ├── app.js          # JavaScript do frontend
│   ├── manifest.json   # Configuração PWA
│   └── sw.js          # Service Worker
└── README.md           # Este arquivo
```

## 🌐 API Endpoints

### Mensagens

- `GET /api/messages` - Listar mensagens agendadas
- `POST /api/messages` - Agendar nova mensagem
- `DELETE /api/messages/:id` - Remover mensagem

### Instâncias

- `GET /api/instances` - Listar instâncias do usuário
- `GET /api/instances/:id` - Obter detalhes da instância
- `POST /api/instances` - Criar nova instância
- `PUT /api/instances/:id` - Atualizar instância
- `DELETE /api/instances/:id` - Remover instância
- `POST /api/instances/:id/activate` - Ativar instância
- `GET /api/instances/active` - Obter instância ativa

### Autenticação

- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `GET /api/auth/status` - Verificar status da autenticação

### Usuários (Admin)

- `GET /api/admin/users` - Listar usuários
- `POST /api/admin/users` - Criar usuário
- `PUT /api/admin/users/:id` - Editar usuário
- `DELETE /api/admin/users/:id` - Remover usuário
- `PUT /api/admin/users/:id/password` - Redefinir senha

## 🔒 Segurança

- Cada usuário tem suas próprias instâncias
- Tokens e senhas são armazenados de forma segura
- Validação de entrada em todos os formulários
- Autenticação e autorização em todas as rotas
- Senhas são geradas aleatoriamente para novos usuários
- Forçar alteração de senha no primeiro login

## 🐛 Solução de Problemas

### Mensagens não são enviadas

#### Erro 401 (Não Autorizado)

- **Problema**: API Key inválida ou não autorizada
- **Solução**:
  1. Verifique se a API Key da Evolution API está correta
  2. Confirme se a API Key tem permissões para enviar mensagens
  3. Use o botão "Testar Conexão" ao criar/editar a instância

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

### Verificação de Instância

1. **Acesse a seção Instâncias**
2. **Clique em "Nova Instância"**
3. **Preencha os campos**:
   - Nome da instância
   - URL da Evolution API (ex: http://localhost:8080)
   - API Key (obtida da Evolution API)
   - Nome da instância (ex: default)
4. **Clique em "Testar Conexão"** para verificar se está funcionando
5. **Clique em "Salvar Instância"**
6. **Ative a instância** clicando no botão "Ativar"

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
