FROM node:22-alpine

# Zona horaria de Chile para que las reglas de horario usen la hora local
RUN apk add --no-cache tzdata
ENV TZ=America/Santiago \
    NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

# Carpeta para los archivos de eventos archivados (npm run eventos:archivar)
RUN mkdir -p /app/archivo && chown node:node /app/archivo

# La aplicación no corre como root
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
