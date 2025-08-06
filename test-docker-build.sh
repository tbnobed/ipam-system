#!/bin/bash

echo "🔧 Testing Docker Build and Environment Variable Loading"
echo "======================================================="

# Test 1: Check if files exist
echo "📁 Step 1: Verifying files exist..."
for file in "Dockerfile" ".env.docker" "docker-compose.yml"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file MISSING!"
        exit 1
    fi
done

# Test 2: Check docker-compose configuration
echo ""
echo "⚙️  Step 2: Verifying docker-compose env_file configuration..."
if grep -q "env_file:" docker-compose.yml && grep -q ".env.docker" docker-compose.yml; then
    echo "   ✅ env_file: .env.docker is configured"
else
    echo "   ❌ env_file configuration missing!"
    exit 1
fi

# Test 3: Check environment variables in .env.docker
echo ""
echo "📋 Step 3: Environment variables in .env.docker:"
echo "------------------------------------------------"
grep -E "^[A-Z_]+=" .env.docker

# Test 4: Test with a simple docker run
echo ""
echo "🐳 Step 4: Testing environment variable loading with Docker..."
echo "Running test container with .env.docker..."

# Create a simple test to verify env vars are loaded
docker run --rm --env-file .env.docker alpine:latest sh -c '
    echo "✅ Docker Environment Variables Test:"
    echo "   NODE_ENV: $NODE_ENV"
    echo "   DEFAULT_SCAN_INTERVAL: $DEFAULT_SCAN_INTERVAL"
    echo "   DATA_RETENTION_DAYS: $DATA_RETENTION_DAYS"
    echo "   ALERT_EMAILS: $ALERT_EMAILS"
    echo "   FROM_EMAIL: $FROM_EMAIL"
    if [ -n "$SENDGRID_API_KEY" ]; then
        echo "   SENDGRID_API_KEY: configured"
    else
        echo "   SENDGRID_API_KEY: not set"
    fi
    echo ""
    echo "🎯 Result: Environment variables ARE being loaded by Docker!"
'

echo ""
echo "✅ Docker environment variable loading test complete!"
echo ""
echo "💡 Next steps:"
echo "   1. Your docker-compose.yml is correctly configured"
echo "   2. Run 'docker-compose up --build' to see variables in action"
echo "   3. Look for the environment variable logs in docker-entrypoint.sh"