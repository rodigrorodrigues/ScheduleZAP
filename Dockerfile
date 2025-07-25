# Etapa 1: Build do frontend
FROM node:18 AS build-frontend
WORKDIR /app
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY ./src ./src
COPY ./index.html ./
RUN npm install && npm run build

# Etapa 2: Instalação do backend
FROM node:18 AS build-backend
WORKDIR /app
COPY --from=build-frontend /app/dist ./frontend-dist
COPY backend ./backend
WORKDIR /app/backend
RUN npm install

# Etapa 3: Imagem final para produção
FROM node:18-slim
WORKDIR /app
COPY --from=build-backend /app/backend .
COPY --from=build-backend /app/frontend-dist ./public

# Instala dependências de produção do backend
RUN npm install --omit=dev

# Servir arquivos estáticos do frontend
RUN npm install express serve-static

# Cria um servidor simples para servir o frontend e a API
COPY docker-entrypoint.js ./docker-entrypoint.js

EXPOSE 8988
EXPOSE 8999
CMD ["node", "docker-entrypoint.js"] 