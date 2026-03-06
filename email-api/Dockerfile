FROM node:22.22.0-slim

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# ... (previous lines)
COPY . .
EXPOSE 5001
# Run migrations and then start the server
CMD ["sh", "-c", "node scripts/migrate.js && node server.js"]