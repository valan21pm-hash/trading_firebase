# 1. Base image ufficiale leggera Python 3.11-slim
FROM python:3.11-slim

# 2. Variabili d'ambiente per evitare il buffering e file .pyc
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# Imposta la directory di lavoro
WORKDIR /app

# Installazione pacchetti di sistema minimi
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 3. Copia e installa le dipendenze sfruttando la cache di build
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 4. Crea un utente non-root sicuro per l'esecuzione
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app

# Copia il codice sorgente dell'applicazione e assegna i permessi
COPY . .
RUN chown -R appuser:appuser /app

# Passa all'utente non-root
USER appuser

# 5. Esponi la porta 8080
EXPOSE 8080

# Comando di avvio uvicorn che ascolta su 0.0.0.0 e usa $PORT con fallback 8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
