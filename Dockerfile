FROM node:18-alpine

# Criar diretório da aplicação
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Criar diretório para logs
RUN mkdir -p /app/logs

# Expor porta
EXPOSE 8988

# Comando para iniciar a aplicação
CMD ["npm", "start"] 