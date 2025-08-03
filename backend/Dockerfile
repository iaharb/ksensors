FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm cache clean --force && \
    npm install --legacy-peer-deps
    
# Copy the rest of the application
COPY . .

EXPOSE 3001

CMD ["npm", "start"]