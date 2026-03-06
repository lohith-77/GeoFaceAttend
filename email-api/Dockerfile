FROM node:22.22.0-slim

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Run database migrations during build
# This ensures tables are created before the app starts
RUN node scripts/migrate.js

# Expose the port
EXPOSE 5001

# Start the application
CMD ["node", "server.js"]