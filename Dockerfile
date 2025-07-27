# Estágio de build
FROM node:18-alpine AS builder

# Definir diretório de trabalho
WORKDIR /build

# Copiar arquivos de dependências
COPY package*.json ./
COPY backend/package*.json ./backend/

# Instalar dependências
RUN npm ci && \
    cd backend && \
    npm ci

# Copiar código fonte
COPY . .

# Build do frontend
RUN npm run build

# Estágio de produção
FROM node:18-alpine

# Instalar dumb-init para melhor gerenciamento de processos
RUN apk add --no-cache dumb-init

# Criar usuário não-root
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos necessários do builder
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/backend ./backend
COPY --from=builder /build/server.js ./

# Criar diretório para dados e configurar permissões
RUN mkdir -p /app/backend && \
    chown -R appuser:appgroup /app

# Instalar apenas dependências de produção
RUN npm install --omit=dev && \
    cd backend && npm install --omit=dev

# Mudar para usuário não-root
USER appuser

# Configurar variáveis de ambiente
ENV NODE_ENV=production \
    PORT=8988

# Criar volume para persistência
VOLUME ["/app/backend"]

# Verificação de saúde
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8988 || exit 1

# Usar dumb-init como entrypoint
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Comando para iniciar a aplicação
CMD ["node", "server.js"] 