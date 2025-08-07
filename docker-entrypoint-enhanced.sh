#!/bin/bash
set -e

echo "Starting IPAM System deployment..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
while ! nc -z postgres 5432; do
    sleep 1
done
echo "PostgreSQL is ready - starting application..."

# Setup database schema with improved error handling
echo "Setting up database schema..."
if ! timeout 60 npm run db:push; then
    echo "Error: Database schema setup failed"
    exit 1
fi
echo "Database schema setup completed successfully"

# Apply database migrations
echo "Applying database migrations..."
if [ -d "/app/migrations" ] && [ "$(ls -A /app/migrations)" ]; then
    echo "Found migration files, they will be applied during application startup"
else
    echo "No migration files found"
fi

# Start the application
echo "Starting IPAM application..."
exec npm run dev