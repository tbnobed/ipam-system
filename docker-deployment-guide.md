# Docker Deployment Guide for IPAM System

## Features Included in Docker Deployment

### ✅ Complete Authentication System
- Session-based authentication with PostgreSQL session storage
- User management with admin/user/viewer roles
- Group permissions with hierarchical access control
- Default users: admin/admin, user/user, viewer/viewer

### ✅ SendGrid Email Notifications
- Configured for device offline/online alerts
- Subnet utilization threshold notifications
- Customizable email recipients via Settings page
- HTML formatted email templates

### ✅ Advanced IPAM Features
- Network scanning with WebSocket real-time updates
- Device tracking across multiple subnets
- Excel export functionality
- Comprehensive settings management
- Activity logging and audit trails

## Quick Deployment

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ipam-system
   ```

2. **Configure SendGrid (Required for Notifications)**
   Edit `.env.docker` and add your SendGrid API key:
   ```env
   SENDGRID_API_KEY=SG.your_actual_sendgrid_api_key_here
   FROM_EMAIL=alerts@obedtv.com
   ALERT_EMAILS=your-email@domain.com
   ```

3. **Deploy the system**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Web Interface: http://localhost:5000
   - Default Login: admin/admin

## Environment Configuration

### Required Settings (.env.docker)

```env
# Database Configuration
NODE_ENV=production
DATABASE_URL=postgresql://ipam_user:ipam_password@postgres:5432/ipam_db
SESSION_SECRET=your-secure-session-secret-here

# SendGrid Email Notifications
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
FROM_EMAIL=alerts@yourdomain.com
ALERT_EMAILS=admin@yourdomain.com,ops@yourdomain.com

# Optional Notification Channels
WEBHOOK_URL=https://your-webhook-endpoint.com
WEBHOOK_TOKEN=your-webhook-auth-token
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SLACK_CHANNEL=#alerts
```

### SendGrid Setup

1. **Create SendGrid Account**: https://sendgrid.com
2. **Generate API Key**: Settings → API Keys → Create API Key
3. **Verify Sender Email**: Marketing → Sender Authentication
4. **Add API Key to .env.docker**: Replace `SG.your_sendgrid_api_key_here`

## Post-Deployment Configuration

### 1. Email Recipients
- Login as admin (admin/admin)
- Go to Settings page
- Update "Email Recipients" field with your email addresses
- Click "Save Settings"
- Test using "Test SendGrid Email" button

### 2. Network Configuration
- Configure your network subnets via the web interface
- Set up VLANs as needed
- Adjust scan intervals in Settings

### 3. User Management
- Create additional users with appropriate permissions
- Assign users to groups for easier permission management
- Configure individual or group-based access to network resources

## Database Persistence

The PostgreSQL database uses Docker volumes for data persistence:
- Volume: `postgres_data`
- Location: `/var/lib/postgresql/data`

**Backup Command:**
```bash
docker exec ipam-system-postgres-1 pg_dump -U ipam_user ipam_db > backup.sql
```

**Restore Command:**
```bash
docker exec -i ipam-system-postgres-1 psql -U ipam_user ipam_db < backup.sql
```

## Monitoring and Logs

### Application Logs
```bash
docker-compose logs -f ipam-app
```

### Database Logs
```bash
docker-compose logs -f postgres
```

### Real-time Monitoring
The system includes built-in monitoring via:
- Dashboard metrics
- Activity logs
- Network scan status
- Email notification delivery logs

## Security Considerations

### Production Deployment
1. **Change Default Passwords**: Update admin/user/viewer credentials
2. **Secure Session Secret**: Generate unique SESSION_SECRET
3. **Network Security**: Use reverse proxy (nginx) with SSL/TLS
4. **Database Security**: Consider external PostgreSQL with SSL
5. **API Key Security**: Store SendGrid API key securely

### Network Access
- Application: Port 5000
- Database: Port 5432 (internal only)
- Consider firewall rules for production

## Troubleshooting

### Email Notifications Not Working
1. Verify SendGrid API key is correct
2. Check sender email is verified in SendGrid
3. Review application logs for SendGrid errors
4. Test notification via Settings page

### Authentication Issues
1. Check session table exists in database
2. Verify users table has correct password hashes
3. Clear browser cookies and retry
4. Check application logs for authentication errors

### Network Scanning Issues
1. Verify network connectivity from Docker container
2. Check subnet configuration in database
3. Review scan logs in application
4. Ensure proper permissions for network operations

## Updating the System

### Standard Update
```bash
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Data-Safe Update (Preserves Database)
```bash
git pull origin main
docker-compose stop ipam-app
docker-compose build --no-cache ipam-app
docker-compose up -d ipam-app
```

## Support and Maintenance

### Regular Maintenance
- Monitor disk usage for database volume
- Review activity logs for security events
- Update SendGrid API keys as needed
- Backup database regularly

### Performance Optimization
- Adjust scan intervals based on network size
- Configure data retention policies
- Monitor PostgreSQL performance metrics
- Consider connection pooling for large deployments

---

**Production Ready**: This Docker deployment includes all authentication, notifications, and IPAM features with proper database persistence and security configurations.