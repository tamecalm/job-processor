# Use a more secure base image with minimal attack surface
FROM node:20-alpine

# Update OS packages to reduce vulnerabilities
RUN apk update && apk upgrade && apk add --no-cache \
    tzdata \
    && rm -rf /var/cache/apk/*

# Set working directory inside container
WORKDIR /app

# Copy package files first for efficient layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy rest of application code
COPY . .

# Expose application port
EXPOSE 3000

# Start application
CMD ["npm", "start"]