# IPAM System Deployment Guide

## Overview
Complete IP Address Management system for broadcast facility network infrastructure with real-time device discovery, WebSocket-based progress tracking, and comprehensive network monitoring.

## Features
- **Real-time Network Discovery**: WebSocket-powered live scan progress with persistent state
- **Advanced Device Management**: Automatic vendor identification, port scanning, MAC address detection
- **VLAN/Subnet Management**: Complete network segmentation with utilization tracking
- **Interactive Dashboard**: Live metrics, recent activity, subnet utilization charts
- **Export Capabilities**: CSV export for network documentation
- **Persistent Scanning**: Background periodic scans every 5 minutes

## Quick Deployment

### Prerequisites
- Docker and Docker Compose installed
- Ubuntu server with network access to target subnets
- Port 5000 available for web interface
- Port 5432 available for PostgreSQL database

### Installation Steps

1. **Clone and Deploy**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

2. **Access Application**
   - Web Interface: http://your-server-ip:5000
   - Database: postgres://ipam_user:ipam_password@localhost:5432/ipam_db

### Manual Deployment

1. **Start Services**
   ```bash
   docker-compose up -d
   ```

2. **Initialize Database**
   ```bash
   docker-compose exec ipam-app npm run db:push
   ```

3. **Verify Deployment**
   ```bash
   docker-compose ps
   curl http://localhost:5000/api/dashboard/metrics
   ```

## Configuration

### Network Scanning
- Scans common ports: 22, 23, 80, 443, 8080, 9000
- Vendor identification for broadcast equipment (Sony, Panasonic, Canon, etc.)
- Automatic periodic scanning every 5 minutes
- Real-time WebSocket updates during active scans

### Database Schema
- VLANs: Network segmentation management
- Subnets: IP range allocation with CIDR notation
- Devices: Complete device inventory with status tracking
- Network Scans: Scan history and results
- Activity Logs: Audit trail for all operations

## Usage

### Starting Network Discovery
1. Navigate to Discovery page
2. Select target subnets
3. Click "Start Scan" 
4. Monitor real-time progress via WebSocket connection
5. View scan completion summary with device breakdown

### Managing VLANs and Subnets
1. Go to VLANs & Subnets page
2. Create VLANs with ID and description
3. Add subnets with CIDR notation and gateway
4. Monitor utilization on dashboard

### Device Management
1. View all discovered devices on Devices page
2. Filter by VLAN, status, or search terms
3. Edit device information manually
4. Ping devices to check connectivity
5. Export device list as CSV

## Monitoring

### Health Checks
- Application: http://localhost:5000/api/dashboard/metrics
- Database: pg_isready via Docker health check
- WebSocket: Connection status indicator in UI

### Logs
```bash
# Application logs
docker-compose logs -f ipam-app

# Database logs  
docker-compose logs -f postgres
```

## Troubleshooting

### Network Scanning Issues
- Ensure Docker container has network access to target subnets
- Check firewall rules for ICMP and TCP port access
- Verify subnet CIDR notation is correct

### Database Connection
- Check PostgreSQL is running: `docker-compose ps`
- Verify environment variables in .env.docker
- Run schema migration: `docker-compose exec ipam-app npm run db:push`

### WebSocket Connection
- Browser console shows "WebSocket connected" message
- Live indicator shows "Live" status in discovery page
- Check for proxy/firewall blocking WebSocket connections

## Production Considerations

### Security
- Change default PostgreSQL password in docker-compose.yml
- Use reverse proxy (nginx) for HTTPS termination
- Implement authentication for multi-user environments

### Performance  
- Database indexes already optimized for queries
- WebSocket connections limited to prevent resource exhaustion
- Periodic scans can be adjusted via environment variables

### Backup
```bash
# Database backup
docker-compose exec postgres pg_dump -U ipam_user ipam_db > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U ipam_user -d ipam_db < backup.sql
```

## Architecture

### Technology Stack
- **Frontend**: React + TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with WebSocket support
- **Database**: PostgreSQL with Drizzle ORM
- **Infrastructure**: Docker containerization

### Real-time Features
- WebSocket connection for live scan progress
- Persistent scan state across page navigation
- Automatic reconnection on connection loss
- Live device discovery notifications

This system provides comprehensive network visibility for broadcast facilities with enterprise-grade reliability and real-time monitoring capabilities.