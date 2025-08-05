#!/bin/bash

# IPAM System Docker Deployment Script
# This script deploys the complete IPAM system with all features

set -e

echo "🚀 Starting IPAM System Docker Deployment"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install docker-compose and try again."
    exit 1
fi

echo "✅ docker-compose is available"

# Create backup of existing data if container exists
if docker ps -a | grep -q "ipam-system"; then
    echo "📦 Existing IPAM system found. Creating backup..."
    
    # Backup database if it's running
    if docker ps | grep -q "postgres"; then
        BACKUP_FILE="ipam_backup_$(date +%Y%m%d_%H%M%S).sql"
        echo "💾 Creating database backup: $BACKUP_FILE"
        docker exec ipam-system-postgres-1 pg_dump -U ipam_user ipam_db > "$BACKUP_FILE" || echo "⚠️  Backup failed, continuing..."
        echo "✅ Backup saved as $BACKUP_FILE"
    fi
    
    echo "🛑 Stopping existing containers..."
    docker-compose down
fi

# Check for required environment configuration
if [ ! -f ".env.docker" ]; then
    echo "❌ .env.docker file not found!"
    echo "📝 Creating template .env.docker file..."
    
    cat > .env.docker << 'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://ipam_user:ipam_password@postgres:5432/ipam_db
SESSION_SECRET=change-this-to-a-secure-random-string-in-production

# SendGrid Configuration for Email Notifications
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
FROM_EMAIL=alerts@obedtv.com
ALERT_EMAILS=alerts@obedtv.com

# Notification Configuration
WEBHOOK_URL=
WEBHOOK_TOKEN=
SLACK_WEBHOOK_URL=
SLACK_CHANNEL=#alerts

# IPAM System Configuration
DEFAULT_SCAN_INTERVAL=300
MAX_DEVICES=10000
DATA_RETENTION_DAYS=90
EOF
    
    echo "📝 Template .env.docker created. Please edit it with your configuration:"
    echo "   - Add your SendGrid API key for email notifications"
    echo "   - Update email addresses for alerts"
    echo "   - Configure other notification channels as needed"
    echo ""
    read -p "Press Enter after configuring .env.docker to continue..."
fi

# Validate SendGrid configuration
if grep -q "SG.your_sendgrid_api_key_here" .env.docker; then
    echo "⚠️  WARNING: SendGrid API key not configured in .env.docker"
    echo "   Email notifications will not work until you add a valid SendGrid API key"
    echo ""
fi

# Pull latest images
echo "📥 Pulling latest Docker images..."
docker-compose pull

# Build the application
echo "🔨 Building IPAM application..."
docker-compose build --no-cache

# Start the services
echo "🚀 Starting IPAM services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check health
echo "🔍 Checking service health..."

# Wait for database
echo "📊 Waiting for database to be ready..."
for i in {1..30}; do
    if docker exec ipam-system-postgres-1 pg_isready -U ipam_user -d ipam_db > /dev/null 2>&1; then
        echo "✅ Database is ready"
        break
    fi
    echo "   Waiting for database... ($i/30)"
    sleep 2
done

# Wait for application
echo "🌐 Waiting for application to be ready..."
for i in {1..30}; do
    if curl -f http://localhost:5000/api/auth/health > /dev/null 2>&1; then
        echo "✅ Application is ready"
        break
    fi
    echo "   Waiting for application... ($i/30)"
    sleep 2
done

# Display service status
echo ""
echo "📋 Service Status:"
echo "=================="
docker-compose ps

# Display application info
echo ""
echo "🎉 IPAM System Deployment Complete!"
echo "===================================="
echo ""
echo "🌐 Web Interface: http://localhost:5000"
echo "📊 Database: localhost:5432"
echo ""
echo "👤 Default Login Accounts:"
echo "   Administrator: admin / admin"
echo "   Standard User: user / user" 
echo "   Viewer: viewer / viewer"
echo ""
echo "⚙️  Features Enabled:"
echo "   ✅ User Authentication & Authorization"
echo "   ✅ Group Permissions System"
echo "   ✅ Network Device Scanning"
echo "   ✅ Real-time WebSocket Updates"
echo "   ✅ Excel Export Functionality"
echo "   ✅ Activity Logging"

# Check SendGrid configuration
if curl -s http://localhost:5000/api/auth/health | grep -q '"notifications":true'; then
    echo "   ✅ Email Notifications (SendGrid)"
else
    echo "   ⚠️  Email Notifications (Not Configured)"
fi

echo ""
echo "📝 Next Steps:"
echo "   1. Login at http://localhost:5000 with admin/admin"
echo "   2. Configure network subnets and VLANs"
echo "   3. Set up email recipients in Settings"
echo "   4. Test notifications using 'Test SendGrid Email' button"
echo "   5. Create additional users and assign permissions"
echo ""
echo "📚 Documentation: See docker-deployment-guide.md for detailed information"
echo ""
echo "🔧 Management Commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop system: docker-compose down"
echo "   Restart: docker-compose restart"
echo "   Database backup: docker exec ipam-system-postgres-1 pg_dump -U ipam_user ipam_db > backup.sql"
echo ""

# Check if services are actually running
if curl -f http://localhost:5000/api/auth/health > /dev/null 2>&1; then
    echo "✅ Deployment successful! System is ready for use."
else
    echo "❌ Deployment may have issues. Check logs with: docker-compose logs"
    exit 1
fi