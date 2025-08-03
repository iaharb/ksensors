FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Set environment variables
ENV FRONTEND_PORT=3000
ENV REACT_APP_API_URL=http://backend:3001

EXPOSE 3000

CMD ["npm", "start"]