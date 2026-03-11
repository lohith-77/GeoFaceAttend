FROM node:18-alpine
WORKDIR /app

# Copy package files from email-api
COPY email-api/package*.json ./email-api/

# Install dependencies
RUN cd email-api && npm install

# Copy all source code
COPY . .

# Expose the port Render will use
EXPOSE 10000

# Start the server
CMD ["node", "email-api/server.js"]
