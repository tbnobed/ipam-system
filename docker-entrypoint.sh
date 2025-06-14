#!/bin/sh
set -e

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until nc -z postgres 5432; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is ready - starting application..."

# Set production environment
export NODE_ENV=production

# Run database migration
echo "Setting up database schema..."
if npm run db:push; then
  echo "Database schema setup completed successfully"
else
  echo "Database schema setup failed, but continuing..."
fi

# Start the application
echo "Starting IPAM application..."
exec npm run dev