# Docker Deployment Guide

This guide explains how to deploy the IPAM System using Docker with complete authentication and authorization features.

## Prerequisites

- Ubuntu Server 20.04 or later (or any Linux distribution)
- Docker and Docker Compose installed
- At least 4GB RAM available
- 10GB+ available disk space

## Quick Deployment

1. Clone or download the project files to your server
2. Deploy with docker-compose:
   ```bash
   docker-compose up --build -d
   ```

That's it! The system will automatically:
- Build the application container
- Set up PostgreSQL database (preserving existing data)
- Update database schema safely
- Create session table
- Set up default users (admin/admin, user/user, viewer/viewer)
- Configure default settings
- Add device tracking functionality (created_by column)
- Apply all database migrations including user permissions and device tracking

## Manual Deployment Steps

If you prefer step-by-step deployment:

1. Stop any existing containers:
   ```bash
   docker-compose down
   ```

2. Build and start the services:
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

3. Check the status:
   ```bash
   docker-compose ps
   ```

4. Verify application health:
   ```bash
   curl http://localhost:5000/api/health
   ```

## Configuration

The Docker setup uses these environment variables (defined in `.env.docker`):
- `NODE_ENV=production`
- `DATABASE_URL=postgresql://ipam_user:ipam_password@postgres:5432/ipam_db`
- `SESSION_SECRET=ipam-production-session-secret-key-change-this-in-production-for-security`

**Important**: Change the SESSION_SECRET in production for security!

## Authentication System

The system includes complete authentication and authorization:

### Default Users
- **Admin**: username: `admin`, password: `admin` (full system access)
- **User**: username: `user`, password: `user` (limited VLAN/subnet access)
- **Viewer**: username: `viewer`, password: `viewer` (read-only access)

### User Roles
1. **Admin**: Full control over entire application and all resources
2. **User**: Can modify VLANs and subnets they have permissions for
3. **Viewer**: Read-only access to assigned resources only

### Features
- Session-based authentication with secure session management
- Resource-based permissions for VLANs and subnets
- Role-based UI controls (buttons/menus hidden based on permissions)
- Password hashing with bcrypt
- Activity logging for audit trails

## Database

- PostgreSQL 15 with automatic schema initialization
- Session table for secure authentication
- User management with permission system
- Data persistence through Docker volumes
- Health checks ensure proper startup sequence

## Network Management

- Real-time network scanning with WebSocket updates
- Multi-subnet support with VLAN organization
- Device discovery and tracking
- Excel export organized by VLAN
- Permission-based data filtering

## Access

- **Application**: http://server-ip:5000
- **Database**: localhost:5432 (from host system)
- **Database Name**: ipam_db
- **Database User**: ipam_user
- **Database Password**: ipam_password

## Security Considerations

### For Production Deployment:
1. **Change default passwords** immediately after first login
2. **Update SESSION_SECRET** in .env.docker with a strong random string
3. **Set up firewall rules** to restrict access to port 5000
4. **Configure HTTPS/TLS** using a reverse proxy (nginx/Apache)
5. **Enable database backups** and regular security updates
6. **Monitor logs** for suspicious activities

## Troubleshooting

1. Check container logs:
   ```bash
   docker-compose logs ipam-app
   docker-compose logs postgres
   ```

2. Check container status:
   ```bash
   docker-compose ps
   ```

3. Restart services:
   ```bash
   docker-compose restart
   ```

4. Rebuild containers:
   ```bash
   docker-compose down
   docker-compose up --build -d
   ```

5. Database issues:
   ```bash
   # Connect to database
   docker-compose exec postgres psql -U ipam_user -d ipam_db
   
   # Check users table
   docker-compose exec postgres psql -U ipam_user -d ipam_db -c "SELECT * FROM users;"
   ```

## Maintenance

### Database Backup
```bash
docker-compose exec postgres pg_dump -U ipam_user ipam_db > backup.sql
```

### Database Restore
```bash
docker-compose exec -T postgres psql -U ipam_user ipam_db < backup.sql
```

### Update Application
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose up --build -d
```

## Complete Reset (⚠️ DESTROYS ALL DATA)
**WARNING: This will delete all your devices, users, and configuration data!**

Only use this if you have a completely broken system:
```bash
# First backup your data!
docker-compose exec postgres pg_dump -U ipam_user ipam_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Then reset (only if absolutely necessary)
docker-compose down --volumes
docker-compose up --build -d
```

This will recreate everything from scratch including the database and user accounts.

## Database Issues
If you encounter database schema issues:

1. **Check database status:**
   ```bash
   docker-compose exec postgres psql -U ipam_user -d ipam_db -c "\d users"
   ```

2. **Fix missing columns manually:**
   ```bash
   docker-compose exec postgres psql -U ipam_user -d ipam_db -c "
   ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
   "
   ```

3. **Complete database reset (⚠️ DESTROYS ALL DATA):**
   ```bash
   # First backup your data!
   docker-compose exec postgres pg_dump -U ipam_user ipam_db > backup.sql
   
   # Then reset (only if absolutely necessary)
   docker-compose down --volumes
   docker system prune -f
   docker-compose up --build -d
   ```

## Container Restart Loop
If the container keeps restarting:
1. Check logs: `docker-compose logs ipam-app`
2. Look for database connection errors
3. Ensure PostgreSQL is fully ready before app starts
4. Reset volumes if database is corrupted

## Maintenance

- Stop system: `docker-compose down`
- Update system: `git pull && docker-compose up --build -d`
- Backup database: `docker-compose exec postgres pg_dump -U ipam_user ipam_db > backup.sql`