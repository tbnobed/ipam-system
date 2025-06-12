# IPAM System - IP Address Management for Broadcast Facilities

A comprehensive full-stack IPAM (IP Address Management) system designed for broadcast facilities to manage and monitor network IP addresses across VLANs and subnets, with device discovery, status monitoring, and network scanning capabilities.

## Features

- **Dashboard**: Real-time overview of network status, device counts, and VLAN utilization
- **Device Management**: Track cameras, switches, storage, and audio equipment across the network
- **Network Discovery**: Automated scanning with ICMP ping sweeps and port detection
- **VLAN Management**: Organize network segments by function (Production, Management, Storage, Audio)
- **Subnet Monitoring**: Track IP allocation and utilization across different network segments
- **Activity Logging**: Comprehensive audit trail of network changes and device status
- **Real-time Status**: Live monitoring of device connectivity and response times

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Network Scanning**: Native ICMP ping and port scanning
- **Containerization**: Docker and Docker Compose

## Quick Start with Docker

### Prerequisites

- Docker and Docker Compose installed on your Ubuntu server
- Git for cloning the repository

### Deployment Steps

1. **Clone the repository**:
   ```bash
   git clone <your-github-repo-url>
   cd ipam-system
   ```

2. **Start the application**:
   ```bash
   docker-compose up -d
   ```

3. **Access the application**:
   - Open your browser and navigate to `http://your-server-ip:5000`
   - Default admin credentials: `admin` / `admin123`

The application will automatically:
- Set up PostgreSQL database with sample data
- Create network tables and seed with broadcast equipment
- Start network scanning services
- Serve the web interface

### Configuration

Edit `docker-compose.yml` to customize:

- **Database credentials**: Change `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- **Application port**: Modify the ports mapping `"5000:5000"`
- **Database port**: Adjust PostgreSQL port if needed `"5432:5432"`

### Sample Data

The system comes pre-loaded with realistic broadcast facility data:

- **Production VLAN (100)**: Studio cameras and production equipment
- **Management VLAN (200)**: Network management interfaces
- **Storage VLAN (300)**: NAS and backup storage systems  
- **Audio VLAN (400)**: Digital mixers and audio routing equipment

## Manual Installation

If you prefer running without Docker:

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Ubuntu/Linux server

### Setup Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up PostgreSQL**:
   ```bash
   sudo -u postgres createdb ipam_db
   sudo -u postgres psql ipam_db < init.sql
   ```

3. **Configure environment**:
   ```bash
   export DATABASE_URL="postgresql://username:password@localhost:5432/ipam_db"
   ```

4. **Build and start**:
   ```bash
   npm run build
   npm start
   ```

## Network Scanning

The system includes automated network discovery:

- **Periodic Scanning**: Runs every 5 minutes across all configured subnets
- **ICMP Ping Sweeps**: Tests connectivity to all IPs in subnet ranges
- **Port Detection**: Scans common ports (22, 23, 80, 443, 8080, 554, 1935)
- **MAC Address Resolution**: Attempts to resolve hardware addresses
- **Vendor Detection**: Identifies equipment manufacturers from MAC addresses

## API Endpoints

- `GET /api/dashboard/metrics` - Network overview statistics
- `GET /api/devices` - Device inventory with filtering
- `GET /api/vlans` - VLAN configuration
- `GET /api/subnets` - Subnet information
- `POST /api/network/scan` - Start network discovery
- `GET /api/activity` - Recent network activity

## Production Considerations

### Security

- Change default admin password immediately
- Use strong database credentials
- Consider running behind a reverse proxy (nginx)
- Enable HTTPS with SSL certificates

### Performance

- For large networks (>1000 devices), consider tuning scan intervals
- Monitor database performance and add indexes as needed
- Use connection pooling for high-concurrent environments

### Backup

- Regular PostgreSQL database backups
- Consider persistent volumes for Docker deployments
- Export device configurations periodically

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Verify PostgreSQL is running
   - Check DATABASE_URL environment variable
   - Ensure database credentials are correct

2. **Network Scanning Not Working**:
   - Verify application has network access
   - Check if ICMP ping is allowed
   - Review firewall settings

3. **Application Won't Start**:
   - Check port 5000 is available
   - Review Docker logs: `docker-compose logs ipam-app`
   - Verify all dependencies are installed

### Logs

- Docker logs: `docker-compose logs -f`
- Application logs: Check console output for network scan results
- Database logs: `docker-compose logs postgres`

## Development

For development and customization:

```bash
# Start development server
npm run dev

# Database migrations
npm run db:push

# Type checking
npm run check
```

## Support

This IPAM system is designed specifically for broadcast facilities managing production equipment across multiple VLANs. The included sample data reflects typical broadcast environments with cameras, switchers, storage, and audio equipment.

## License

MIT License - see LICENSE file for details