#!/bin/bash

echo "Starting IPAM System deployment..."

# Stop any existing containers
docker-compose down -v

# Build and start the services
docker-compose up --build -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 15

# Check PostgreSQL connection
until docker-compose exec -T postgres pg_isready -U ipam_user -d ipam_db > /dev/null 2>&1; do
  echo "Waiting for PostgreSQL..."
  sleep 3
done

# Push database schema
echo "Setting up database schema..."
docker-compose exec -T ipam-app npm run db:push

echo "IPAM System deployment completed!"
echo "Application is available at http://localhost:5000"

# Show running containers
docker-compose ps