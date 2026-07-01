FROM node:20-alpine

WORKDIR /app

# Copia i file di dipendenza
COPY package*.json ./

# Installa tutte le dipendenze
RUN npm install

# Copia il codice
COPY . .

# Esegui la build (vite build + esbuild)
RUN npm run build

# Espone la porta usata dal backend (3000)
EXPOSE 3000

# Variabili d'ambiente utili per la produzione
ENV NODE_ENV=production

# Avvia l'app
CMD ["npm", "start"]
