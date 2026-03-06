# Use the official Node.js 22 image as a base
FROM node:22.22.0-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first (for better layer caching)
COPY package*.json ./

# Install dependencies using npm ci for a clean, predictable install
RUN npm ci --only=production

# Copy the rest of the application source code
COPY . .

# Expose the port your app runs on
EXPOSE 5001

# Define the command to run your app
CMD ["node", "server.js"]