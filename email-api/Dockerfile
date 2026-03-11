FROM node:18-alpine
WORKDIR /app

# Copy package files (they're in the current directory)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source code
COPY . .

# Expose the port Render will use
EXPOSE 10000

# Start the server
CMD ["node", "server.js"]
