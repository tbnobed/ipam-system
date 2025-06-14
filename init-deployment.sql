-- Deployment initialization script for IPAM system
-- Ensures consistent database state and prevents device clustering

-- Create function to validate device-subnet assignments
CREATE OR REPLACE FUNCTION validate_device_subnet_assignment()
RETURNS TRIGGER AS $$
DECLARE
    subnet_network TEXT;
    subnet_cidr INTEGER;
    network_int BIGINT;
    ip_int BIGINT;
    mask BIGINT;
    network_address BIGINT;
    broadcast_address BIGINT;
BEGIN
    -- Get subnet information
    SELECT network INTO subnet_network FROM subnets WHERE id = NEW.subnet_id;
    
    IF subnet_network IS NULL THEN
        RAISE EXCEPTION 'Invalid subnet_id: %', NEW.subnet_id;
    END IF;
    
    -- Parse network and CIDR
    subnet_cidr := CAST(split_part(subnet_network, '/', 2) AS INTEGER);
    
    -- Convert IP addresses to integers for comparison
    SELECT (split_part(NEW.ip_address, '.', 1)::bigint << 24) +
           (split_part(NEW.ip_address, '.', 2)::bigint << 16) +
           (split_part(NEW.ip_address, '.', 3)::bigint << 8) +
           split_part(NEW.ip_address, '.', 4)::bigint
    INTO ip_int;
    
    SELECT (split_part(split_part(subnet_network, '/', 1), '.', 1)::bigint << 24) +
           (split_part(split_part(subnet_network, '/', 1), '.', 2)::bigint << 16) +
           (split_part(split_part(subnet_network, '/', 1), '.', 3)::bigint << 8) +
           split_part(split_part(subnet_network, '/', 1), '.', 4)::bigint
    INTO network_int;
    
    -- Calculate network boundaries
    mask := (4294967295::bigint << (32 - subnet_cidr))::bigint & 4294967295::bigint;
    network_address := (network_int & mask);
    broadcast_address := (network_address | (4294967295::bigint >> subnet_cidr));
    
    -- Validate IP is within subnet range (excluding network and broadcast)
    IF ip_int <= network_address OR ip_int >= broadcast_address THEN
        RAISE EXCEPTION 'IP address % does not belong to subnet % (network: %, broadcast: %)', 
            NEW.ip_address, subnet_network, network_address, broadcast_address;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate device assignments on insert/update
DROP TRIGGER IF EXISTS validate_device_subnet ON devices;
CREATE TRIGGER validate_device_subnet
    BEFORE INSERT OR UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION validate_device_subnet_assignment();

-- Create index for faster device queries by subnet
CREATE INDEX IF NOT EXISTS idx_devices_subnet_id ON devices(subnet_id);
CREATE INDEX IF NOT EXISTS idx_devices_ip_address ON devices(ip_address);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);

-- Create function to redistribute misassigned devices
CREATE OR REPLACE FUNCTION redistribute_devices()
RETURNS TABLE(
    device_id INTEGER,
    ip_address TEXT,
    old_subnet_id INTEGER,
    new_subnet_id INTEGER,
    action TEXT
) AS $$
DECLARE
    device_rec RECORD;
    correct_subnet_id INTEGER;
    subnet_rec RECORD;
    ip_int BIGINT;
    network_int BIGINT;
    mask BIGINT;
    network_address BIGINT;
    broadcast_address BIGINT;
BEGIN
    -- Loop through all devices
    FOR device_rec IN SELECT * FROM devices LOOP
        correct_subnet_id := NULL;
        
        -- Convert device IP to integer
        SELECT (split_part(device_rec.ip_address, '.', 1)::bigint << 24) +
               (split_part(device_rec.ip_address, '.', 2)::bigint << 16) +
               (split_part(device_rec.ip_address, '.', 3)::bigint << 8) +
               split_part(device_rec.ip_address, '.', 4)::bigint
        INTO ip_int;
        
        -- Find correct subnet
        FOR subnet_rec IN SELECT * FROM subnets LOOP
            -- Convert subnet network to integer
            SELECT (split_part(split_part(subnet_rec.network, '/', 1), '.', 1)::bigint << 24) +
                   (split_part(split_part(subnet_rec.network, '/', 1), '.', 2)::bigint << 16) +
                   (split_part(split_part(subnet_rec.network, '/', 1), '.', 3)::bigint << 8) +
                   split_part(split_part(subnet_rec.network, '/', 1), '.', 4)::bigint
            INTO network_int;
            
            -- Calculate network boundaries
            mask := (4294967295::bigint << (32 - CAST(split_part(subnet_rec.network, '/', 2) AS INTEGER)))::bigint & 4294967295::bigint;
            network_address := (network_int & mask);
            broadcast_address := (network_address | (4294967295::bigint >> CAST(split_part(subnet_rec.network, '/', 2) AS INTEGER)));
            
            -- Check if IP belongs to this subnet
            IF ip_int > network_address AND ip_int < broadcast_address THEN
                correct_subnet_id := subnet_rec.id;
                EXIT;
            END IF;
        END LOOP;
        
        -- If device is in wrong subnet, return correction info
        IF correct_subnet_id IS NOT NULL AND correct_subnet_id != device_rec.subnet_id THEN
            RETURN QUERY SELECT 
                device_rec.id,
                device_rec.ip_address,
                device_rec.subnet_id,
                correct_subnet_id,
                'UPDATE devices SET subnet_id = ' || correct_subnet_id || ' WHERE id = ' || device_rec.id || ';';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Show any misassigned devices that need correction
SELECT * FROM redistribute_devices();