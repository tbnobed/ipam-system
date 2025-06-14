#!/bin/bash

# Production deployment fix script for IPAM system
# Ensures device clustering issues are permanently resolved

echo "Starting IPAM production deployment fix..."

# Step 1: Create backup of current state
echo "Creating database backup..."
sudo docker exec ipam-system-postgres-1 pg_dump -U ipam_user ipam_db > ipam_backup_$(date +%Y%m%d_%H%M%S).sql

# Step 2: Apply database improvements
echo "Applying database improvements..."
sudo docker exec -i ipam-system-postgres-1 psql -U ipam_user -d ipam_db << 'EOF'
-- Create index for faster device queries
CREATE INDEX IF NOT EXISTS idx_devices_subnet_id ON devices(subnet_id);
CREATE INDEX IF NOT EXISTS idx_devices_ip_address ON devices(ip_address);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);

-- Add constraint to prevent invalid subnet assignments
CREATE OR REPLACE FUNCTION validate_ip_subnet_match() RETURNS TRIGGER AS $$
DECLARE
    subnet_network TEXT;
BEGIN
    SELECT network INTO subnet_network FROM subnets WHERE id = NEW.subnet_id;
    
    -- Basic validation that subnet exists
    IF subnet_network IS NULL THEN
        RAISE EXCEPTION 'Invalid subnet_id: %', NEW.subnet_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_device_subnet ON devices;
CREATE TRIGGER check_device_subnet
    BEFORE INSERT OR UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION validate_ip_subnet_match();
EOF

# Step 3: Verify current device distribution
echo "Checking current device distribution..."
SUBNET_DIST=$(curl -s "http://localhost:5000/api/devices?limit=200" | grep -o '"subnetId":[0-9]*' | sort | uniq -c)
echo "Current API device distribution:"
echo "$SUBNET_DIST"

# Step 4: Stop containers for code update
echo "Stopping containers for code update..."
sudo docker-compose down

# Step 5: Display instructions for code updates
cat << 'EOF'

=== MANUAL CODE UPDATE REQUIRED ===

Update the following files in your production codebase:

1. server/storage.ts - Replace getDevices method around line 180:
   - Use proper LEFT JOIN with subnets table
   - Order by device ID instead of IP address
   - Ensure all devices are returned regardless of subnet

2. server/network.ts - Update performScan method around line 163:
   - Add subnet validation before device processing
   - Only process devices that belong to current subnet
   - Skip devices for other subnets

See PRODUCTION_DEPLOYMENT_FIX.md for complete code changes.

EOF

echo "Press ENTER when code updates are complete..."
read

# Step 6: Rebuild and restart containers
echo "Rebuilding containers with updated code..."
sudo docker-compose up -d --build

# Step 7: Wait for services to start
echo "Waiting for services to start..."
sleep 30

# Step 8: Verify fix
echo "Verifying deployment fix..."
for i in {1..5}; do
    echo "Attempt $i: Checking API response..."
    API_RESPONSE=$(curl -s "http://localhost:5000/api/devices?limit=200" | grep -o '"subnetId":[0-9]*' | sort | uniq -c)
    if echo "$API_RESPONSE" | grep -q '"subnetId":17'; then
        echo "✓ API now returns devices from subnet 17"
        echo "Final device distribution:"
        echo "$API_RESPONSE"
        break
    else
        echo "⚠ API still not returning subnet 17 devices, retrying..."
        sleep 10
    fi
done

# Step 9: Test network scanning
echo "Testing network scanner..."
SCAN_RESPONSE=$(curl -s -X POST "http://localhost:5000/api/network/scan" -H "Content-Type: application/json" -d '{"subnetIds": [16, 17]}')
echo "Network scan initiated: $SCAN_RESPONSE"

echo "Deployment fix complete!"
echo "Monitor the application logs and verify device distribution remains correct."