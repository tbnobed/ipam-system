-- Fix device clustering issues on startup
-- This script automatically redistributes devices to correct subnets

-- Create function to find correct subnet for IP address
CREATE OR REPLACE FUNCTION find_subnet_for_ip(ip_addr TEXT) 
RETURNS INTEGER AS $$
DECLARE
    subnet_rec RECORD;
    ip_int BIGINT;
    network_int BIGINT;
    mask BIGINT;
    network_address BIGINT;
    broadcast_address BIGINT;
    cidr_num INTEGER;
BEGIN
    -- Convert IP to integer
    SELECT (split_part(ip_addr, '.', 1)::bigint << 24) +
           (split_part(ip_addr, '.', 2)::bigint << 16) +
           (split_part(ip_addr, '.', 3)::bigint << 8) +
           split_part(ip_addr, '.', 4)::bigint
    INTO ip_int;
    
    -- Check each subnet
    FOR subnet_rec IN SELECT id, network FROM subnets LOOP
        -- Parse CIDR
        cidr_num := split_part(subnet_rec.network, '/', 2)::integer;
        
        -- Convert network to integer
        SELECT (split_part(split_part(subnet_rec.network, '/', 1), '.', 1)::bigint << 24) +
               (split_part(split_part(subnet_rec.network, '/', 1), '.', 2)::bigint << 16) +
               (split_part(split_part(subnet_rec.network, '/', 1), '.', 3)::bigint << 8) +
               split_part(split_part(subnet_rec.network, '/', 1), '.', 4)::bigint
        INTO network_int;
        
        -- Calculate network boundaries
        mask := (4294967295::bigint << (32 - cidr_num))::bigint & 4294967295::bigint;
        network_address := (network_int & mask);
        broadcast_address := (network_address | (4294967295::bigint >> cidr_num));
        
        -- Check if IP belongs to this subnet (excluding network and broadcast)
        IF ip_int > network_address AND ip_int < broadcast_address THEN
            RETURN subnet_rec.id;
        END IF;
    END LOOP;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Redistribute devices to correct subnets
DO $$
DECLARE
    device_rec RECORD;
    correct_subnet_id INTEGER;
    updated_count INTEGER := 0;
BEGIN
    -- Loop through all devices
    FOR device_rec IN SELECT id, ip_address, subnet_id FROM devices LOOP
        -- Find correct subnet for this device
        correct_subnet_id := find_subnet_for_ip(device_rec.ip_address);
        
        -- If device is in wrong subnet, update it
        IF correct_subnet_id IS NOT NULL AND correct_subnet_id != device_rec.subnet_id THEN
            UPDATE devices 
            SET subnet_id = correct_subnet_id 
            WHERE id = device_rec.id;
            updated_count := updated_count + 1;
        END IF;
    END LOOP;
    
    -- Log the result
    RAISE NOTICE 'Device redistribution complete. Updated % devices.', updated_count;
END;
$$;

-- Show final device distribution
SELECT 
    s.id as subnet_id,
    s.network,
    COUNT(d.id) as device_count,
    MIN(d.ip_address) as min_ip,
    MAX(d.ip_address) as max_ip
FROM subnets s
LEFT JOIN devices d ON d.subnet_id = s.id
GROUP BY s.id, s.network
ORDER BY s.id;