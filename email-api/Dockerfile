FROM node:22.22.0-slim 
WORKDIR /usr/src/app 
COPY package*.json ./ 
RUN npm ci --only=production 
COPY . . 
EXPOSE 5001 
CMD ["node", "server.js"] 
