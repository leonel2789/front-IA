# Dockerfile (versión simple)
FROM node:18-alpine

WORKDIR /app

# Copiar archivos de package
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Instalar Expo CLI globalmente
RUN npm install -g @expo/cli

# Exponer puerto
EXPOSE 3000

# Comando para iniciar la aplicación web
CMD ["npx", "expo", "start", "--web", "--port", "3000"]