# Changelog

## v2.0.0 - Múltiplas Instâncias por Usuário

### Adicionado

- Sistema de múltiplas instâncias por usuário
- Interface para gerenciar instâncias (criar, editar, excluir, ativar)
- Associação de mensagens com instâncias específicas
- Teste de conexão por instância

### Removido

- Sistema de configuração global
- Configuração por usuário via admin
- Rotas e funções relacionadas à configuração global

### Alterado

- Migração do banco de dados para suportar múltiplas instâncias
- Atualização do Service Worker para não cachear APIs
- Atualização da interface para refletir o novo sistema
- Melhorias na segurança e performance

### Corrigido

- Problemas de cache em APIs
- Problemas de atualização em tempo real
- Problemas de compatibilidade com versões anteriores

## v1.0.0 - Versão Inicial

### Adicionado

- Sistema de agendamento de mensagens
- Autenticação de usuários
- Painel administrativo
- Configuração da Evolution API
- Interface responsiva
- Suporte a PWA
