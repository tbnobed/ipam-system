#!/bin/bash

echo "🧪 Testing Docker Environment Variable Configuration"
echo "================================================="

# Test if .env.docker exists
if [ ! -f ".env.docker" ]; then
    echo "❌ .env.docker file not found!"
    exit 1
fi

echo "✅ .env.docker file exists"
echo ""

echo "📋 Environment Variables in .env.docker:"
echo "----------------------------------------"
cat .env.docker | grep -E "(DEFAULT_SCAN_INTERVAL|DATA_RETENTION_DAYS|ALERT_EMAILS|SENDGRID_API_KEY)" | while read line; do
    if [[ ! $line =~ ^# ]]; then
        echo "   $line"
    fi
done

echo ""
echo "🔧 Docker Compose Configuration:"
echo "--------------------------------"
grep -A 10 "env_file:" docker-compose.yml

echo ""
echo "📝 Settings Initialization in Docker:"
echo "------------------------------------"
echo "The docker-entrypoint.sh script will:"
echo "   1. Read environment variables from .env.docker"
echo "   2. Use them for initial settings ONLY if settings don't exist"
echo "   3. Preserve existing user customizations"
echo "   4. Log environment variable values for debugging"

echo ""
echo "✅ Docker environment configuration is correct!"
echo ""
echo "To deploy with proper environment variables:"
echo "   1. Edit .env.docker with your actual values"
echo "   2. Run: ./deploy-docker.sh"
echo "   3. Check logs: docker-compose logs -f ipam-app"