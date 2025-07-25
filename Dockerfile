# Etapa 1: Build do frontend
FROM node:18-alpine AS build-frontend
WORKDIR /app
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY ./src ./src
COPY ./index.html ./
RUN npm ci && npm run build

# Etapa 2: Instalação do backend
FROM node:18-alpine AS build-backend
WORKDIR /app
COPY --from=build-frontend /app/dist ./frontend-dist
COPY backend ./backend
WORKDIR /app/backend
RUN npm ci --only=production

# Etapa 3: Imagem final para produção
FROM node:18-alpine
WORKDIR /app

# Instalar dependências necessárias
RUN apk add --no-cache dumb-init

# Copiar arquivos do build
COPY --from=build-backend /app/backend .
COPY --from=build-backend /app/frontend-dist ./public

# Criar arquivo de agendamentos vazio se não existir
RUN touch schedules.json

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S schedulezap -u 1001
RUN chown -R schedulezap:nodejs /app
USER schedulezap

# Verificação de saúde
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8988', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

EXPOSE 8988
EXPOSE 8999

# Usar dumb-init para gerenciar sinais corretamente
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "docker-entrypoint.js"] 