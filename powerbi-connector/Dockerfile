FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm install rethinkdbdash

COPY . .

EXPOSE 3000 8081
CMD ["node", "server.js"]