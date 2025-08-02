FROM node:18

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY scripts/ ./scripts/
COPY backend/ ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "server.js"]