#!/bin/bash

echo "=== IPAM Production Fix Script ==="
echo "This script applies critical subnet assignment fixes to your production environment"
echo

# Step 1: Restart the application with the latest fixes
echo "Step 1: Restarting application with enhanced subnet matching logic..."
sudo docker-compose restart ipam-app
echo "Waiting for application startup..."
sleep 15

# Step 2: Apply device subnet corrections
echo "Step 2: Applying device subnet corrections..."
RESULT=$(sudo docker exec ipam-system-ipam-app-1 curl -s -X POST "http://localhost:5000/api/admin/fix-device-subnets" -H "Content-Type: application/json")
echo "Fix result: $RESULT"

# Step 3: Run comprehensive network scan
echo "Step 3: Running comprehensive network scan to rediscover devices..."
SCAN_RESULT=$(sudo docker exec ipam-system-ipam-app-1 curl -s -X POST "http://localhost:5000/api/network/scan" -H "Content-Type: application/json" -d '{"subnetIds": []}')
echo "Scan started: $SCAN_RESULT"

# Step 4: Wait for scan completion and check results
echo "Step 4: Waiting for scan completion..."
sleep 60

# Check device count after fixes
DEVICE_COUNT=$(sudo docker exec ipam-system-ipam-app-1 curl -s "http://localhost:5000/api/devices" | jq -r '.total')
echo "Total devices after fix: $DEVICE_COUNT"

# Check device distribution by subnet
echo "Device distribution by subnet:"
sudo docker exec ipam-system-ipam-app-1 curl -s "http://localhost:5000/api/devices?limit=200" | jq -r '.data[] | select(.ipAddress | startswith("10.63.20")) | .ipAddress' | wc -l | awk '{print "10.63.20.x devices: " $1}'
sudo docker exec ipam-system-ipam-app-1 curl -s "http://localhost:5000/api/devices?limit=200" | jq -r '.data[] | select(.ipAddress | startswith("10.63.21")) | .ipAddress' | wc -l | awk '{print "10.63.21.x devices: " $1}'

echo
echo "=== Fix Complete ==="
echo "The IPAM system should now correctly display devices from both 10.63.20.x and 10.63.21.x subnets simultaneously."