# FORTRESS (self-hosted, SQLite) edition of the FMCG Distributor Control System.
FROM node:20-slim

# Install runtime deps for native modules if prebuilt binaries are unavailable.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies first (better layer caching).
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the application.
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Basic container healthcheck against the API.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
