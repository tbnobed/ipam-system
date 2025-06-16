#!/bin/bash

echo "=== Checking production database state ==="

echo "1. Checking subnets table:"
sudo docker exec -i ipam-system-postgres-1 psql -U postgres -d ipam -c "SELECT id, network, description FROM subnets ORDER BY id;"

echo -e "\n2. Checking devices count:"
sudo docker exec -i ipam-system-postgres-1 psql -U postgres -d ipam -c "SELECT COUNT(*) as total_devices FROM devices;"

echo -e "\n3. Checking devices by subnet:"
sudo docker exec -i ipam-system-postgres-1 psql -U postgres -d ipam -c "SELECT subnet_id, COUNT(*) as device_count FROM devices GROUP BY subnet_id ORDER BY subnet_id;"

echo -e "\n4. Sample devices (first 5):"
sudo docker exec -i ipam-system-postgres-1 psql -U postgres -d ipam -c "SELECT id, ip_address, subnet_id FROM devices ORDER BY id LIMIT 5;"

echo -e "\n5. Testing subnet assignment function:"
sudo docker exec -i ipam-system-postgres-1 psql -U postgres -d ipam -c "SELECT find_subnet_for_ip('10.63.20.1') as subnet_for_20_1, find_subnet_for_ip('10.63.21.1') as subnet_for_21_1;"