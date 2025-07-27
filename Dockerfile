# Build stage
FROM node:18-alpine as builder

# Instalar dumb-init para melhor gerenciamento de processos
RUN apk add --no-cache dumb-init

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY backend/package*.json ./backend/

# Instalar dependências do frontend e backend
RUN npm ci && cd backend && npm ci

# Copiar código fonte
COPY . .

# Build do frontend
RUN npm run build

# Configuração de produção
FROM node:18-alpine

# Instalar dumb-init
RUN apk add --no-cache dumb-init

# Criar diretório de trabalho
WORKDIR /app

# Copiar dependências e build do frontend
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend/package*.json ./
COPY --from=builder /app/backend ./backend

# Instalar apenas dependências de produção do backend
RUN cd backend && npm ci --only=production

# Copiar script de entrada
COPY docker-entrypoint.js .

# Expor porta
EXPOSE 8988

# Usar dumb-init como entrypoint
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Comando para iniciar a aplicação
CMD ["node", "docker-entrypoint.js"] 