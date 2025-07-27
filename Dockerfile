# Estágio de build
FROM node:18-alpine AS builder

# Definir diretório de trabalho
WORKDIR /build

# Copiar arquivos de dependências
COPY package*.json ./
COPY backend/package*.json ./backend/

# Instalar dependências
RUN npm ci && cd backend && npm ci

# Copiar código fonte
COPY . .

# Build do frontend
RUN npm run build

# Estágio de produção
FROM node:18-alpine

# Instalar dumb-init
RUN apk add --no-cache dumb-init

# Criar usuário não-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos necessários
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/backend ./backend
COPY --from=builder /build/server.js ./
COPY --from=builder /build/package.json ./

# Instalar dependências de produção
RUN npm ci --only=production && cd backend && npm ci --only=production

# Configurar permissões
RUN chown -R appuser:appgroup /app

# Mudar para usuário não-root
USER appuser

# Configurar variáveis de ambiente
ENV NODE_ENV=production PORT=8988

# Volume para persistência
VOLUME ["/app/backend"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8988 || exit 1

# Entrypoint
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Comando
CMD ["node", "server.js"] 