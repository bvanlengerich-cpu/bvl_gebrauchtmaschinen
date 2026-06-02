FROM node:20-bookworm-slim

# Build-Tools fuer better-sqlite3 (native Modul)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Datenverzeichnis (wird per Volume persistent gemacht)
ENV DATA_DIR=/data
RUN mkdir -p /data/uploads
VOLUME ["/data"]

EXPOSE 3000
CMD ["node", "server.js"]
