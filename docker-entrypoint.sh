#!/bin/sh
set -e

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until nc -z postgres 5432; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is ready - applying production fixes..."

# Set production environment
export NODE_ENV=production

# Initialize database with clean schema
echo "Initializing database with clean schema..."
if PGPASSWORD=$POSTGRES_PASSWORD psql -h postgres -U $POSTGRES_USER -d $POSTGRES_DB -f /app/init-db.sql; then
  echo "Database initialization completed successfully"
else
  echo "Database initialization failed, but continuing..."
fi

# Apply device clustering fix
echo "Applying device clustering fix..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h postgres -U $POSTGRES_USER -d $POSTGRES_DB -f /app/fix-device-clustering.sql

echo "Database fixes applied successfully"

# Start the application
echo "Starting IPAM application..."
exec npm run dev