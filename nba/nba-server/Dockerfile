# Usar la imagen oficial de Node.js (versión 20, requerida por better-sqlite3)
FROM node:20

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código del servidor
COPY . .

# Exponer el puerto que usa el backend
EXPOSE 3000

# Comando para iniciar el servidor
CMD ["node", "server.js"]
