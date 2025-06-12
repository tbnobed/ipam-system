#!/bin/bash

# IPAM System Deployment Script for Ubuntu Server
# This script automates the deployment process

set -e

echo "🚀 Starting IPAM System deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "Docker installed. Please log out and back in to use Docker without sudo."
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Create application directory
APP_DIR="/opt/ipam-system"
echo "Creating application directory at $APP_DIR..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Copy application files (assuming script is run from project directory)
echo "Copying application files..."
cp -r . $APP_DIR/
cd $APP_DIR

# Create Docker volumes
echo "Creating Docker volumes..."
sudo docker volume create ipam_postgres_data

# Start the application
echo "Starting IPAM System..."
sudo docker-compose up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 30

# Check if services are running
if sudo docker-compose ps | grep -q "Up"; then
    echo "✅ IPAM System deployed successfully!"
    echo ""
    echo "🌐 Access your application at: http://$(hostname -I | awk '{print $1}'):5000"
    echo "👤 Default login: admin / admin123"
    echo ""
    echo "📊 Useful commands:"
    echo "  - View logs: docker-compose logs -f"
    echo "  - Stop system: docker-compose down"
    echo "  - Restart system: docker-compose restart"
    echo "  - Update system: git pull && docker-compose up -d --build"
else
    echo "❌ Deployment failed. Check logs:"
    sudo docker-compose logs
    exit 1
fi

echo "🔧 Post-deployment tasks:"
echo "1. Change the default admin password"
echo "2. Configure firewall rules if needed"
echo "3. Set up SSL certificate for HTTPS"
echo "4. Schedule regular database backups"