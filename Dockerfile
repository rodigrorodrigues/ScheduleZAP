# Build stage
FROM node:18-alpine as builder

# Instalar dependências necessárias
RUN apk add --no-cache dumb-init

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY backend/package*.json ./backend/

# Instalar dependências do frontend e backend
RUN npm ci && \
    cd backend && \
    npm ci

# Copiar código fonte
COPY . .

# Build do frontend
RUN npm run build

# Configuração de produção
FROM node:18-alpine

# Instalar dumb-init e outras dependências necessárias
RUN apk add --no-cache dumb-init tzdata && \
    cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && \
    echo "America/Sao_Paulo" > /etc/timezone && \
    apk del tzdata

# Criar usuário não-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Criar diretório de trabalho
WORKDIR /app

# Copiar arquivos necessários do builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copiar script de entrada
COPY docker-entrypoint.js .

# Configurar permissões
RUN chown -R appuser:appgroup /app

# Mudar para usuário não-root
USER appuser

# Expor porta
EXPOSE 8988

# Configurar variáveis de ambiente
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo

# Configurar healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --spider http://localhost:8988 || exit 1

# Usar dumb-init como entrypoint
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Comando para iniciar a aplicação
CMD ["node", "docker-entrypoint.js"] 