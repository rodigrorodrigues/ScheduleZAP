# ScheduleZAP - Agendador de Mensagens WhatsApp

Um aplicativo web para agendar mensagens no WhatsApp via Evolution API v2.

## 🚀 Funcionalidades

- **Login Simples**: Autenticação com usuário e senha
- **Configuração Evolution API v2**: Interface para configurar a conexão
- **Token de Autenticação**: Suporte completo ao token da Evolution API v2
- **QR Code Integration**: Geração e escaneamento de QR Code para conexão
- **Agendamento de Mensagens**: Crie agendamentos com contato, mensagem e horário
- **Visualização de Agendamentos**: Veja todas as mensagens agendadas
- **Cancelamento**: Cancele agendamentos pendentes
- **Design Mobile-First**: Interface otimizada para dispositivos móveis
- **Integração Completa**: Contatos carregados exclusivamente da Evolution API v2

## 🛠️ Tecnologias

- **React 18** com TypeScript
- **Vite** para build e desenvolvimento
- **Tailwind CSS** para estilização
- **React Router** para navegação
- **React Hook Form** para formulários
- **React Hot Toast** para notificações
- **Lucide React** para ícones
- **Date-fns** para manipulação de datas
- **Axios** para integração com APIs

- Design simplificado sem muitas opções

## 🚀 Como Executar

### Pré-requisitos

- Node.js 16+
- npm ou yarn
- Evolution API v2 rodando

### Instalação

1. Clone o repositório:

```bash
git clone <url-do-repositorio>
cd ScheduleZAP
```

2. Instale as dependências:

```bash
npm install
```

3. Execute o projeto:

```bash
npm run dev
```

4. Acesse o aplicativo em `http://localhost:3000`

### Credenciais de Demonstração

- **Usuário**: admin
- **Senha**: 123456

## ⚙️ Configuração da Evolution API v2

### Primeiro Acesso

1. Faça login no sistema
2. Vá para "Config" no menu
3. Configure a URL da API (ex: http://localhost:8080)
4. Digite o nome da instância do WhatsApp
5. **Digite o token de autenticação da Evolution API**
6. Clique em "Salvar Configuração"
7. Gere o QR Code e escaneie com o WhatsApp
8. Clique em "Testar Conexão" para verificar

### Configuração Necessária

O sistema requer configuração da Evolution API v2 antes de usar:

- **URL da API**: Endereço onde a Evolution API v2 está rodando
- **Nome da Instância**: Nome da instância do WhatsApp configurada
- **Token de Autenticação**: Token obrigatório para autenticar com a API
- **QR Code**: Gerado automaticamente para conexão
- **Status de Conexão**: Verificação automática da conectividade

### Token de Autenticação

O token é **obrigatório** para usar a Evolution API v2. Você pode:

1. **Obter o token** da sua instalação da Evolution API
2. **Configurar no sistema** através da página de configurações
3. **Testar a conexão** para verificar se está funcionando

## 📋 Estrutura do Projeto

cd backen```
src/
├── components/ # Componentes reutilizáveis
│ └── Layout.tsx # Layout principal com navegação
├── contexts/ # Contextos React
│ └── AuthContext.tsx # Contexto de autenticação
├── pages/ # Páginas da aplicação
│ ├── Dashboard.tsx # Página inicial
│ ├── Login.tsx # Página de login
│ ├── ScheduleMessage.tsx # Agendar mensagem
│ ├── ScheduledMessages.tsx # Listar agendamentos
│ └── Settings.tsx # Configurações da API
├── services/ # Serviços e APIs
│ └── api.ts # Configuração da API
├── App.tsx # Componente principal
├── main.tsx # Ponto de entrada
└── index.css # Estilos globais

````

## 🔧 Endpoints da Evolution API v2

O aplicativo usa os seguintes endpoints conforme [documentação oficial](https://doc.evolution-api.com/v2/api-reference/get-information):

### Instâncias

- `GET /instance/info/{instanceName}` - Obter informações da instância
- `GET /instance/fetchInstances` - Listar todas as instâncias
- `POST /instance/connect/{instanceName}` - Conectar instância
- `DELETE /instance/logout/{instanceName}` - Desconectar instância

### Chat

- `POST /chat/findContacts/{instanceName}` - Listar contatos
- `POST /chat/sendText/{instanceName}` - Enviar mensagem de texto
- `POST /chat/sendImage/{instanceName}` - Enviar mensagem de imagem
- `POST /chat/sendDocument/{instanceName}` - Enviar mensagem de documento
- `POST /chat/findMessages/{instanceName}` - Obter mensagens
- `POST /chat/markMessageAsRead/{instanceName}` - Marcar como lida

### Grupos

- `GET /group/fetchAllGroups/{instanceName}` - Listar grupos
- `GET /group/findGroupMembers/{instanceName}` - Obter participantes

### Webhook

- `GET /webhook/find/{instanceName}` - Obter webhook
- `POST /webhook/set/{instanceName}` - Configurar webhook

## 📱 Funcionalidades Principais

### 1. Dashboard

- Verificação de configuração da API (incluindo token)
- Visão geral das estatísticas (após configuração)
- Cards com total, pendentes, enviadas e canceladas
- Ações rápidas para agendar ou ver mensagens
- Lista das mensagens mais recentes

### 2. Configurações

- Interface para configurar Evolution API v2
- Campo para token de autenticação
- Geração de QR Code para conexão
- Teste de conexão em tempo real
- Status visual da conectividade
- Validação de configurações
- Instruções passo a passo

### 3. Agendar Mensagem

- Seleção de contato (carregado da Evolution API v2)
- Campo de texto para a mensagem
- Seleção de data e hora
- Validação de campos
- Confirmação de agendamento
- Verificação de configuração (incluindo token)

### 4. Mensagens Agendadas

- Lista de todas as mensagens
- Filtros por status
- Cancelamento de agendamentos pendentes
- Visualização detalhada de cada mensagem

## 🎨 Design System

### Cores

- **Primary**: Green (#16a34a)
- **Secondary**: Gray tones
- **Status Colors**:
  - Pending: Yellow
  - Sent: Green
  - Cancelled: Red
  - Connected: Green
  - Disconnected: Red

### Componentes

- Cards com sombra suave e bordas arredondadas
- Botões com estados hover
- Inputs com foco visual
- Badges para status
- Ícones consistentes

## 🔄 Estados da Aplicação

### Mensagens

- **Pendente**: Aguardando envio
- **Enviada**: Mensagem enviada com sucesso
- **Cancelada**: Agendamento cancelado

### Autenticação

- Login persistente via localStorage
- Proteção de rotas
- Logout automático

### Configuração

- **Conectado**: Evolution API funcionando
- **Desconectado**: Problema na conexão
- **Testando**: Verificando conectividade
- **Não configurado**: Configuração necessária

### Contatos

- Carregamento exclusivo da Evolution API v2
- Sem fallback para dados locais
- Verificação de configuração obrigatória (incluindo token)

## 📦 Build para Produção

```bash
npm run build
````

O build será gerado na pasta `dist/`.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 🆘 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.
