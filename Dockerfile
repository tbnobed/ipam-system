# Use single stage for simplicity in production
FROM node:20-alpine

WORKDIR /app

# Install dependencies for health checks, networking, and PostgreSQL client
RUN apk add --no-cache curl netcat-openbsd postgresql-client

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for tsx)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 5000

# Health check - use health endpoint which doesn't require auth
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Use custom entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]