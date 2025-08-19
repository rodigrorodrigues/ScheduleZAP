# Correções de Bugs - Sistema de Múltiplas Instâncias

## Problemas Identificados e Corrigidos

### 1. Erro 404 em `/api/config`

**Problema:** A função `loadConfig()` ainda estava tentando acessar a rota `/api/config` que foi removida.

**Solução:**

- Atualizada função `loadConfig()` para usar `/api/instances/active`
- Removida dependência da configuração global
- Agora verifica se há uma instância ativa antes de carregar grupos

### 2. Erro 500 em `/api/config/status`

**Problema:** A função `loadChats()` estava tentando acessar `/api/config/status` que causava erro interno.

**Solução:**

- Removida rota `/api/config/status` do servidor
- Atualizada função `loadChats()` para usar `/api/instances/active`
- Interface agora redireciona para seção "Instâncias" quando não há instância ativa

### 3. Funções Obsoletas de Configuração

**Problema:** Várias funções relacionadas ao sistema antigo de configuração ainda existiam.

**Soluções:**

- Removida função `getUserConfig()` do banco de dados
- Removida função `saveUserConfig()` do banco de dados
- Removidas rotas `/api/admin/users/:id/config` do servidor
- Removidas funções `openUserConfigModal()`, `saveUserConfigFromModal()`, `testUserConnection()` do frontend
- Removido modal `userConfigModal` do HTML
- Removido botão de configuração da lista de usuários

### 4. Incompatibilidade de APIs

**Problema:** Algumas funções ainda referenciam APIs que não existem mais.

**Soluções:**

- Atualizada função `loadGroupsCacheIfNeeded()` para usar instâncias
- Removidas referências a `getUserConfig` e `saveUserConfig`
- Atualizada lógica de verificação de configuração para verificar instâncias ativas

## Mudanças Realizadas

### Backend (server.js)

- ❌ Removida rota `/api/config/status`
- ❌ Removidas rotas `/api/admin/users/:id/config` (GET e POST)
- ❌ Removida rota `/api/admin/users/:id/test-connection`
- ✅ Mantidas rotas de instâncias funcionando corretamente

### Frontend (app.js)

- ✅ Atualizada função `loadConfig()` para usar instâncias
- ✅ Atualizada função `loadChats()` para verificar instância ativa
- ❌ Removida função `openUserConfigModal()`
- ❌ Removida função `saveUserConfigFromModal()`
- ❌ Removida função `testUserConnection()`
- ✅ Mantidas funções de gerenciamento de instâncias

### Interface (index.html)

- ❌ Removido modal `userConfigModal`
- ❌ Removido botão de configuração da lista de usuários
- ✅ Mantido modal de instâncias funcionando

### Banco de Dados (database.js)

- ❌ Removidas funções `getUserConfig()` e `saveUserConfig()`
- ✅ Mantidas funções de instâncias funcionando

## Resultado

Após as correções, o sistema agora:

1. **Não apresenta erros 404/500** ao carregar
2. **Redireciona corretamente** para seção de instâncias quando necessário
3. **Funciona com o novo sistema** de múltiplas instâncias
4. **Mantém compatibilidade** com dados existentes
5. **Interface limpa** sem elementos obsoletos

## Como Testar

1. **Login**: Fazer login com usuário admin
2. **Primeiro acesso**: Sistema deve redirecionar para seção "Instâncias"
3. **Criar instância**: Criar primeira instância sem erros
4. **Ativar instância**: Ativar instância sem problemas
5. **Agendar mensagem**: Deve funcionar com instância ativa
6. **Carregar grupos**: Deve carregar grupos da instância ativa

## Logs Esperados

Após as correções, os logs devem mostrar:

```
Nenhuma instância ativa encontrada
```

Em vez de erros 404/500.

Quando uma instância estiver ativa:

```
Instância ativa encontrada: [Nome da Instância]
Cache de grupos atualizado: X grupos
```
