# Correções na API Evolution v2 - ScheduleZAP

## Problemas Identificados e Corrigidos

### 1. **Mistura de Endpoints v1 e v2**

**Problema:** O código estava usando endpoints da v1 (`/group/fetchAllGroups/`) junto com endpoints da v2 (`/chat/findChats/`).

**Solução:**

- Removido o endpoint v1 `/group/fetchAllGroups/`
- Implementado corretamente o endpoint v2 `/chat/findChats/{instance}` com POST
- Adicionado suporte a parâmetros de paginação corretos

### 2. **Estrutura de Dados Inconsistente**

**Problema:** O mapeamento de dados estava tentando acessar propriedades que podem não existir na v2.

**Solução:**

- Criada função `normalizeEvolutionV2Data()` para normalizar diferentes formatos de resposta
- Suporte a múltiplas estruturas de resposta da API v2
- Validação robusta de dados antes do mapeamento

### 3. **Paginação Mal Implementada**

**Problema:** A lógica de paginação não estava funcionando corretamente.

**Solução:**

- Implementada paginação correta com `page` e `limit`
- Adicionado cálculo de `offset` para controle preciso
- Melhorada a lógica de `hasMore` para indicar se há mais páginas

### 4. **Falta de Tratamento de Erros Robusto**

**Problema:** Erros não eram tratados adequadamente para diferentes cenários da v2.

**Solução:**

- Adicionado fallback para endpoint alternativo (GET)
- Melhor tratamento de erros com mensagens específicas
- Logs detalhados para debug

## Novas Funcionalidades Implementadas

### 1. **Função de Normalização de Dados**

```javascript
function normalizeEvolutionV2Data(data) {
  // Suporte a múltiplas estruturas de resposta
  // Validação robusta de dados
  // Mapeamento consistente para o frontend
}
```

### 2. **Rota de Teste da Evolution API v2**

```javascript
GET / api / evolution / test;
```

- Testa a conexão com a Evolution API v2
- Verifica se a instância existe
- Testa o endpoint de chats
- Retorna informações detalhadas sobre o status

### 3. **Melhor Tratamento de Diferentes Formatos de Resposta**

A API v2 pode retornar dados em diferentes formatos:

- Array direto: `[{...}, {...}]`
- Objeto com propriedade `chats`: `{chats: [...]}`
- Objeto com propriedade `data`: `{data: [...]}`
- Objeto com propriedade `response`: `{response: [...]}`

## Endpoints Corrigidos

### Antes (v1 + v2 misturado):

```javascript
// ❌ Endpoint v1 (removido)
GET / group / fetchAllGroups / { instance };

// ❌ Endpoint v2 mal implementado
GET / chat / findChats / { instance };
```

### Depois (v2 correto):

```javascript
// ✅ Endpoint v2 correto
POST /chat/findChats/{instance}
{
  "page": 1,
  "limit": 50,
  "onlyGroups": false,
  "onlyContacts": false,
  "includeGroups": true,
  "includeContacts": true
}
```

## Estrutura de Resposta Normalizada

### Formato Padrão Retornado:

```javascript
{
  "success": true,
  "chats": [
    {
      "id": "5511999999999@s.whatsapp.net",
      "name": "Nome do Contato",
      "profilePicUrl": "https://...",
      "updatedAt": "2024-01-01T00:00:00Z",
      "type": "individual"
    },
    {
      "id": "123456789@g.us",
      "name": "Nome do Grupo",
      "profilePicUrl": "https://...",
      "updatedAt": "2024-01-01T00:00:00Z",
      "type": "group",
      "size": 25,
      "owner": "5511999999999@s.whatsapp.net",
      "desc": "Descrição do grupo"
    }
  ],
  "currentPage": 1,
  "hasMore": true,
  "totalInPage": 50,
  "totalFound": 50
}
```

## Melhorias no Frontend

### 1. **Teste de Conexão Atualizado**

- Agora usa a nova rota `/api/evolution/test`
- Mostra informações detalhadas sobre a conexão
- Exibe número de chats encontrados

### 2. **Melhor Tratamento de Erros**

- Mensagens de erro mais específicas
- Logs detalhados para debug
- Fallback automático em caso de falha

## Como Testar

### 1. **Teste de Conexão**

```bash
curl -X GET "http://localhost:8988/api/evolution/test" \
  -H "Content-Type: application/json"
```

### 2. **Buscar Chats**

```bash
curl -X GET "http://localhost:8988/api/chats?page=1&limit=10" \
  -H "Content-Type: application/json"
```

### 3. **Verificar Logs**

Os logs agora são mais detalhados e incluem:

- Estrutura da resposta recebida
- Número de chats encontrados
- Dados normalizados
- Erros específicos da API v2

## Compatibilidade

- ✅ Evolution API v2
- ✅ Diferentes formatos de resposta
- ✅ Paginação correta
- ✅ Tratamento de erros robusto
- ✅ Fallback automático
- ✅ Logs detalhados para debug

## Próximos Passos

1. **Testar com diferentes instâncias** da Evolution API v2
2. **Validar paginação** com grandes volumes de dados
3. **Monitorar performance** com a nova implementação
4. **Adicionar cache** se necessário para melhorar performance
