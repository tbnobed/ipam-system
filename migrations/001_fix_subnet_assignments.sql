-- Migration: Fix subnet assignments and prevent future misassignments
-- Version: 001
-- Description: Ensures devices are correctly assigned to subnets based on IP addresses

-- Create function to find correct subnet for an IP address
CREATE OR REPLACE FUNCTION find_correct_subnet_for_ip(ip_addr TEXT) 
RETURNS INTEGER AS $$
DECLARE
    subnet_record RECORD;
    ip_parts INTEGER[];
    network_parts INTEGER[];
BEGIN
    -- Parse IP address into octets
    ip_parts := string_to_array(ip_addr, '.')::INTEGER[];
    
    -- Look for matching /24 subnets (most common case)
    FOR subnet_record IN 
        SELECT id, network FROM subnets WHERE network LIKE '%/24'
    LOOP
        -- Parse network address
        network_parts := string_to_array(split_part(subnet_record.network, '/', 1), '.')::INTEGER[];
        
        -- Check if first 3 octets match exactly
        IF ip_parts[1] = network_parts[1] AND 
           ip_parts[2] = network_parts[2] AND 
           ip_parts[3] = network_parts[3] AND
           ip_parts[4] BETWEEN 1 AND 254 THEN
            RETURN subnet_record.id;
        END IF;
    END LOOP;
    
    -- If no exact match found, return NULL
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to automatically assign devices to correct subnets
CREATE OR REPLACE FUNCTION auto_assign_device_subnet() 
RETURNS TRIGGER AS $$
DECLARE
    correct_subnet_id INTEGER;
BEGIN
    -- Find correct subnet for the device's IP address
    correct_subnet_id := find_correct_subnet_for_ip(NEW.ip_address);
    
    -- If we found a correct subnet, assign it
    IF correct_subnet_id IS NOT NULL THEN
        NEW.subnet_id := correct_subnet_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that runs before INSERT or UPDATE on devices
DROP TRIGGER IF EXISTS trigger_auto_assign_subnet ON devices;
CREATE TRIGGER trigger_auto_assign_subnet
    BEFORE INSERT OR UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_device_subnet();

-- Fix existing device assignments
UPDATE devices 
SET subnet_id = find_correct_subnet_for_ip(ip_address)
WHERE find_correct_subnet_for_ip(ip_address) IS NOT NULL
  AND subnet_id != find_correct_subnet_for_ip(ip_address);

-- Create index to improve performance of IP-based lookups
CREATE INDEX IF NOT EXISTS idx_devices_ip_address ON devices(ip_address);
CREATE INDEX IF NOT EXISTS idx_subnets_network ON subnets(network);

-- Log the migration (use timestamp field that exists in the schema)
INSERT INTO activity_logs (action, entity_type, details, timestamp)
VALUES ('migration_applied', 'system', '{"migration": "001_fix_subnet_assignments", "description": "Applied automatic subnet assignment logic"}', NOW());