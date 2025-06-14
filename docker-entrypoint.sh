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

# Set database password for psql commands
export PGPASSWORD=$POSTGRES_PASSWORD

# Only apply fixes if this is the first run (check for marker file)
if [ ! -f /app/.database-initialized ]; then
  echo "First run detected - applying database fixes..."
  
  # Initialize database with clean schema
  echo "Initializing database schema..."
  if psql -h postgres -U $POSTGRES_USER -d $POSTGRES_DB -f /app/init-db.sql 2>/dev/null; then
    echo "Database schema initialized"
  else
    echo "Database schema already exists, skipping..."
  fi

  # Apply device clustering fix
  echo "Applying device clustering fix..."
  if psql -h postgres -U $POSTGRES_USER -d $POSTGRES_DB -f /app/fix-device-clustering.sql 2>/dev/null; then
    echo "Device clustering fix applied"
  else
    echo "Device clustering fix already applied or failed, continuing..."
  fi
  
  # Create marker file to prevent re-running fixes
  touch /app/.database-initialized
  echo "Database initialization complete"
else
  echo "Database already initialized, skipping fixes..."
fi

# Start the application
echo "Starting IPAM application..."
exec npm run dev