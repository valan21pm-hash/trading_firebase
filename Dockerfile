# Usa un'immagine ufficiale leggera di Node.js
FROM node:20-alpine

WORKDIR /app

# Copia i file delle dipendenze per sfruttare la cache di Docker
COPY package*.json ./

# Installa tutte le dipendenze
RUN npm install

# Copia tutto il resto del codice
COPY . .

# Esegui la build (genera dist/ statico e compila server.ts in dist/server.cjs)
RUN npm run build

# Espone la porta usata dal backend
EXPOSE 3000

# Imposta l'ambiente in produzione
ENV NODE_ENV=production

# Avvia l'app tramite lo script start configurato nel package.json
CMD ["npm", "start"]
