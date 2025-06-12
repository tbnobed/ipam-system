# Docker Deployment Guide

This guide explains how to deploy the IPAM System using Docker on Ubuntu Server.

## Prerequisites

- Ubuntu Server 20.04 or later
- Docker and Docker Compose installed
- At least 2GB RAM available

## Quick Deployment

1. Clone or download the project files to your server
2. Make the deployment script executable:
   ```bash
   chmod +x deploy.sh
   ```
3. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

## Manual Deployment

If you prefer to deploy manually:

1. Stop any existing containers:
   ```bash
   docker-compose down -v
   ```

2. Build and start the services:
   ```bash
   docker-compose up --build -d
   ```

3. Check the status:
   ```bash
   docker-compose ps
   ```

## Configuration

The Docker setup uses these environment variables (defined in `.env.docker`):
- `NODE_ENV=production`
- `DATABASE_URL=postgresql://ipam_user:ipam_password@postgres:5432/ipam_db`

## Database

- PostgreSQL 15 with automatic schema initialization
- Data persistence through Docker volumes
- Health checks ensure proper startup sequence

## Troubleshooting

1. Check container logs:
   ```bash
   docker-compose logs ipam-app
   docker-compose logs postgres
   ```

2. Restart services:
   ```bash
   docker-compose restart
   ```

3. Rebuild containers:
   ```bash
   docker-compose up --build -d
   ```

## Access

- Application: http://server-ip:5000
- Database: localhost:5432 (from host system)

## Maintenance

- Stop system: `docker-compose down`
- Update system: `git pull && docker-compose up --build -d`
- Backup database: `docker-compose exec postgres pg_dump -U ipam_user ipam_db > backup.sql`