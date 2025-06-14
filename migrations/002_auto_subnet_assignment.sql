-- Migration to add automatic subnet assignment trigger
-- This prevents devices from being assigned to wrong subnets

-- Function to find correct subnet for an IP address
CREATE OR REPLACE FUNCTION find_subnet_for_ip(ip_addr TEXT)
RETURNS INTEGER AS $$
DECLARE
    subnet_record RECORD;
    ip_parts INTEGER[];
    network_parts INTEGER[];
    ip_prefix TEXT;
    network_prefix TEXT;
    host_octet INTEGER;
BEGIN
    -- Parse IP address
    ip_parts := string_to_array(ip_addr, '.')::INTEGER[];
    
    -- Check if valid IPv4
    IF array_length(ip_parts, 1) != 4 THEN
        RETURN NULL;
    END IF;
    
    -- Loop through all subnets to find match
    FOR subnet_record IN SELECT id, network FROM subnets LOOP
        -- Handle /24 networks with exact prefix matching
        IF subnet_record.network LIKE '%/24' THEN
            network_parts := string_to_array(split_part(subnet_record.network, '/', 1), '.')::INTEGER[];
            
            -- Compare first 3 octets
            ip_prefix := ip_parts[1] || '.' || ip_parts[2] || '.' || ip_parts[3];
            network_prefix := network_parts[1] || '.' || network_parts[2] || '.' || network_parts[3];
            
            IF ip_prefix = network_prefix THEN
                host_octet := ip_parts[4];
                -- Validate host octet (1-254 for /24)
                IF host_octet >= 1 AND host_octet <= 254 THEN
                    RETURN subnet_record.id;
                END IF;
            END IF;
        END IF;
    END LOOP;
    
    -- No match found
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-assign subnet
CREATE OR REPLACE FUNCTION auto_assign_device_subnet()
RETURNS TRIGGER AS $$
DECLARE
    correct_subnet_id INTEGER;
BEGIN
    -- Find correct subnet for the IP address
    correct_subnet_id := find_subnet_for_ip(NEW.ip_address);
    
    -- If we found a matching subnet, use it
    IF correct_subnet_id IS NOT NULL THEN
        NEW.subnet_id := correct_subnet_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
DROP TRIGGER IF EXISTS device_auto_subnet_insert ON devices;
CREATE TRIGGER device_auto_subnet_insert
    BEFORE INSERT ON devices
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_device_subnet();

-- Create trigger for UPDATE operations (only when IP address changes)
DROP TRIGGER IF EXISTS device_auto_subnet_update ON devices;
CREATE TRIGGER device_auto_subnet_update
    BEFORE UPDATE ON devices
    FOR EACH ROW
    WHEN (OLD.ip_address IS DISTINCT FROM NEW.ip_address)
    EXECUTE FUNCTION auto_assign_device_subnet();