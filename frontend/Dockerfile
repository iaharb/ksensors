FROM node:18-alpine
# Set working directory
WORKDIR /app
# Copy package files first for better caching
COPY package*.json ./
# Install dependencies
RUN npm install --include=dev
RUN npm install -g nodemon

# Copy the rest of the application
COPY . .
# Expose port
EXPOSE 8088
# Start the server
CMD ["nodemon", "server.js"]