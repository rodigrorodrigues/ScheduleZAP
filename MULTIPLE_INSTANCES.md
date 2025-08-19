# Sistema de Múltiplas Instâncias por Usuário

## Visão Geral

O ScheduleZAP agora suporta múltiplas instâncias da Evolution API por usuário, permitindo que cada usuário conecte seu próprio número do WhatsApp e gerencie quantas instâncias quiser.

## Funcionalidades

### 1. Gerenciamento de Instâncias

- **Criar Instâncias**: Cada usuário pode criar múltiplas instâncias
- **Editar Instâncias**: Modificar configurações de instâncias existentes
- **Deletar Instâncias**: Remover instâncias não utilizadas
- **Ativar Instâncias**: Definir qual instância está ativa para envio de mensagens

### 2. Instância Ativa

- Apenas uma instância pode estar ativa por usuário
- Mensagens são enviadas através da instância ativa
- Grupos são carregados da instância ativa
- Interface mostra claramente qual instância está ativa

### 3. Separação de Dados

- Cada mensagem é associada à instância que a criou
- Usuários veem apenas suas próprias instâncias
- Dados são completamente isolados entre usuários

## Estrutura do Banco de Dados

### Nova Tabela: `user_instances`

```sql
CREATE TABLE user_instances (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  evolutionApiUrl TEXT NOT NULL,
  token TEXT NOT NULL,
  instanceName TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

### Modificação na Tabela: `scheduled_messages`

- Adicionada coluna `instance_id` para associar mensagens às instâncias

## APIs Implementadas

### Instâncias

- `GET /api/instances` - Listar instâncias do usuário
- `GET /api/instances/:id` - Obter instância específica
- `POST /api/instances` - Criar nova instância
- `PUT /api/instances/:id` - Atualizar instância
- `DELETE /api/instances/:id` - Deletar instância
- `POST /api/instances/:id/activate` - Ativar instância
- `GET /api/instances/active` - Obter instância ativa

### Teste de Conexão

- `POST /api/evolution/test` - Testar conexão de instância específica

## Interface do Usuário

### Nova Seção: Instâncias

- Menu lateral com ícone de servidor
- Lista de instâncias com status (ativa/inativa)
- Botões para criar, editar, ativar e deletar
- Informações detalhadas de cada instância

### Modal de Instância

- Campos para nome, URL, API Key e nome da instância
- Botão para testar conexão
- Validação de campos obrigatórios
- Suporte para criar e editar

## Fluxo de Trabalho

### 1. Primeiro Acesso

1. Usuário faz login
2. Acessa seção "Instâncias"
3. Cria sua primeira instância
4. Ativa a instância
5. Pode começar a agendar mensagens

### 2. Uso Diário

1. Usuário agenda mensagens (usa instância ativa automaticamente)
2. Pode trocar de instância ativa quando necessário
3. Pode criar novas instâncias para outros números
4. Mensagens são enviadas pela instância ativa

### 3. Gerenciamento

1. Usuário pode ter múltiplas instâncias
2. Apenas uma instância ativa por vez
3. Pode editar configurações a qualquer momento
4. Pode deletar instâncias não utilizadas

## Benefícios

### Para o Usuário

- **Flexibilidade**: Múltiplos números do WhatsApp
- **Organização**: Cada instância tem um nome descritivo
- **Controle**: Escolhe qual instância usar para cada situação
- **Segurança**: Dados isolados por usuário

### Para o Sistema

- **Escalabilidade**: Suporte a múltiplos usuários e instâncias
- **Manutenibilidade**: Código organizado e bem estruturado
- **Performance**: Cache otimizado por instância
- **Segurança**: Isolamento completo de dados

## Migração

### Banco de Dados

- Migração automática na inicialização
- Criação da nova tabela `user_instances`
- Adição da coluna `instance_id` em `scheduled_messages`
- Preservação de dados existentes

### Compatibilidade

- Sistema mantém compatibilidade com instalações existentes
- Migração gradual e transparente
- Sem perda de dados

## Como Usar

### 1. Criar Instância

1. Acesse "Instâncias" no menu lateral
2. Clique em "Nova Instância"
3. Preencha os campos:
   - **Nome**: Identificação da instância (ex: "WhatsApp Pessoal")
   - **URL**: URL da Evolution API (ex: http://localhost:8080)
   - **API Key**: Chave de autenticação
   - **Nome da Instância**: Nome configurado na Evolution API
4. Teste a conexão
5. Salve a instância

### 2. Ativar Instância

1. Na lista de instâncias, clique no botão de ativar (✓)
2. A instância ficará marcada como "Ativa"
3. Todas as mensagens serão enviadas por esta instância

### 3. Agendar Mensagens

1. Com uma instância ativa, vá para "Agendar"
2. As mensagens serão automaticamente associadas à instância ativa
3. O sistema usará a instância ativa para envio

## Exemplos de Uso

### Cenário 1: Usuário com Dois Números

- **Instância 1**: "WhatsApp Pessoal" (número pessoal)
- **Instância 2**: "WhatsApp Trabalho" (número profissional)
- Usuário ativa a instância apropriada conforme necessário

### Cenário 2: Múltiplos Projetos

- **Instância 1**: "Projeto A" (cliente específico)
- **Instância 2**: "Projeto B" (outro cliente)
- **Instância 3**: "Suporte Geral" (atendimento geral)

### Cenário 3: Backup e Redundância

- **Instância 1**: "Principal" (número principal)
- **Instância 2**: "Backup" (número de reserva)
- Usuário pode trocar rapidamente em caso de problemas

## Considerações Técnicas

### Performance

- Cache de grupos por instância
- Queries otimizadas com JOINs
- Índices apropriados no banco de dados

### Segurança

- Validação de propriedade de instâncias
- Isolamento completo entre usuários
- Sanitização de inputs

### Manutenibilidade

- Código modular e bem documentado
- APIs RESTful consistentes
- Tratamento de erros robusto
