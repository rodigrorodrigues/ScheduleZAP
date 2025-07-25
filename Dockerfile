# --- Build do frontend ---
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY ./src ./src
COPY ./index.html ./
RUN npm ci && npm run build

# --- Build do backend ---
FROM node:18-alpine AS backend-build
WORKDIR /app
COPY backend ./backend
WORKDIR /app/backend
RUN npm ci --only=production
COPY docker-entrypoint.js /app/backend/docker-entrypoint.js
RUN touch /app/backend/schedules.json

# --- Imagem final do backend ---
FROM node:18-alpine AS backend
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY --from=backend-build /app/backend .
USER nobody
EXPOSE 8999
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "docker-entrypoint.js"]

# --- Imagem final do frontend ---
FROM node:18-alpine AS frontend
WORKDIR /app
COPY --from=frontend-build /app/dist ./dist
RUN npm install -g serve
USER nobody
EXPOSE 8988
CMD ["serve", "-s", "dist", "-l", "8988"] 