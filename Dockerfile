# Stage 1: Build the full-stack Node.js application
FROM node:20-slim

WORKDIR /app

# Install standard system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci || npm install

# Copy all application source code
COPY . .

# Run production build (Vite build + esbuild bundling of server.ts)
RUN npm run build

# Configure environment variables
ENV NODE_ENV=production \
    PORT=8080

# Expose production port
EXPOSE 8080

# Create a non-root user for security
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app

USER appuser

# Start the Node.js Express server
CMD ["sh", "-c", "node dist/server.cjs"]

