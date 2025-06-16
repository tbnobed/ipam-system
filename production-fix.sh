#!/bin/bash

# Production fix for subnet assignment issue
# This script applies the database fix directly to your running PostgreSQL container

echo "Applying subnet assignment fix to production database..."

# Apply the SQL fix
sudo docker exec -i ipam-system-postgres-1 psql -U postgres -d ipam << 'EOF'
-- Drop the faulty function and recreate with proper CIDR precedence
DROP FUNCTION IF EXISTS find_subnet_for_ip(TEXT);

CREATE OR REPLACE FUNCTION find_subnet_for_ip(ip_addr TEXT)
RETURNS INTEGER AS $$
DECLARE
    subnet_record RECORD;
    ip_int BIGINT;
    network_int BIGINT;
    mask BIGINT;
    network_parts INTEGER[];
    ip_parts INTEGER[];
    cidr INTEGER;
    host_bits INTEGER;
BEGIN
    -- Parse IP address
    ip_parts := string_to_array(ip_addr, '.')::INTEGER[];
    
    -- Check if valid IPv4
    IF array_length(ip_parts, 1) != 4 THEN
        RETURN NULL;
    END IF;
    
    -- Convert IP to integer
    ip_int := (ip_parts[1]::BIGINT << 24) + (ip_parts[2]::BIGINT << 16) + (ip_parts[3]::BIGINT << 8) + ip_parts[4]::BIGINT;
    
    -- Loop through subnets ordered by CIDR specificity (most specific first)
    FOR subnet_record IN 
        SELECT id, network 
        FROM subnets 
        ORDER BY split_part(network, '/', 2)::INTEGER DESC, network
    LOOP
        -- Parse network and CIDR
        network_parts := string_to_array(split_part(subnet_record.network, '/', 1), '.')::INTEGER[];
        cidr := split_part(subnet_record.network, '/', 2)::INTEGER;
        host_bits := 32 - cidr;
        
        -- Convert network to integer
        network_int := (network_parts[1]::BIGINT << 24) + (network_parts[2]::BIGINT << 16) + (network_parts[3]::BIGINT << 8) + network_parts[4]::BIGINT;
        
        -- Create subnet mask
        IF host_bits >= 32 THEN
            mask := 0;
        ELSE
            mask := (4294967295::BIGINT << host_bits) & 4294967295::BIGINT;
        END IF;
        
        -- Check if IP is in this subnet
        IF (ip_int & mask) = (network_int & mask) THEN
            RETURN subnet_record.id;
        END IF;
    END LOOP;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT 'Testing subnet assignment:' as message;
SELECT '10.63.20.1 -> subnet ' || find_subnet_for_ip('10.63.20.1') as test1;
SELECT '10.63.21.1 -> subnet ' || find_subnet_for_ip('10.63.21.1') as test2;

-- Fix existing device assignments
DO $$
DECLARE
    device_record RECORD;
    correct_subnet_id INTEGER;
    corrections_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Fixing existing device subnet assignments...';
    
    FOR device_record IN SELECT id, ip_address, subnet_id FROM devices WHERE ip_address IS NOT NULL LOOP
        correct_subnet_id := find_subnet_for_ip(device_record.ip_address);
        
        IF correct_subnet_id IS NOT NULL AND correct_subnet_id != device_record.subnet_id THEN
            UPDATE devices 
            SET subnet_id = correct_subnet_id 
            WHERE id = device_record.id;
            
            corrections_count := corrections_count + 1;
            RAISE NOTICE 'Fixed device % (%): subnet % -> %', 
                device_record.id, 
                device_record.ip_address, 
                device_record.subnet_id, 
                correct_subnet_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Fixed % device subnet assignments', corrections_count;
END;
$$;

SELECT 'Database fix completed successfully!' as result;
EOF

echo "Database fix applied. Your multi-subnet functionality should now work correctly."
echo "Test with: curl -s http://localhost:5000/api/devices | jq '.data[] | {id, ipAddress, subnetId}'"