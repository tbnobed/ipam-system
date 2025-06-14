-- Migration 002: Database triggers for automatic subnet assignment
-- This prevents subnet assignment issues by automatically ensuring devices
-- are assigned to the correct subnet based on their IP address

-- Function to automatically assign devices to correct subnet on insert/update
CREATE OR REPLACE FUNCTION auto_assign_device_subnet()
RETURNS TRIGGER AS $$
DECLARE
    target_subnet_id INTEGER;
BEGIN
    -- Find the correct subnet for this IP address
    SELECT s.id INTO target_subnet_id
    FROM subnets s
    WHERE NEW.ip_address LIKE (SPLIT_PART(s.network, '/', 1) || '%')
    ORDER BY LENGTH(s.network) DESC
    LIMIT 1;
    
    -- If we found a matching subnet, assign it
    IF target_subnet_id IS NOT NULL THEN
        NEW.subnet_id := target_subnet_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for device insertion
DROP TRIGGER IF EXISTS trigger_auto_assign_subnet_insert ON devices;
CREATE TRIGGER trigger_auto_assign_subnet_insert
    BEFORE INSERT ON devices
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_device_subnet();

-- Create trigger for device updates
DROP TRIGGER IF EXISTS trigger_auto_assign_subnet_update ON devices;
CREATE TRIGGER trigger_auto_assign_subnet_update
    BEFORE UPDATE ON devices
    FOR EACH ROW
    WHEN (OLD.ip_address IS DISTINCT FROM NEW.ip_address)
    EXECUTE FUNCTION auto_assign_device_subnet();

-- Function to prevent accidental device deletion during subnet operations
CREATE OR REPLACE FUNCTION prevent_device_orphaning()
RETURNS TRIGGER AS $$
BEGIN
    -- When a subnet is being deleted, reassign its devices to correct subnets
    UPDATE devices 
    SET subnet_id = (
        SELECT s.id 
        FROM subnets s 
        WHERE devices.ip_address LIKE (SPLIT_PART(s.network, '/', 1) || '%')
        AND s.id != OLD.id
        ORDER BY LENGTH(s.network) DESC
        LIMIT 1
    )
    WHERE subnet_id = OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for subnet deletion
DROP TRIGGER IF EXISTS trigger_prevent_device_orphaning ON subnets;
CREATE TRIGGER trigger_prevent_device_orphaning
    BEFORE DELETE ON subnets
    FOR EACH ROW
    EXECUTE FUNCTION prevent_device_orphaning();

-- Log the migration
INSERT INTO activity_logs (action, entity_type, details, timestamp)
VALUES ('migration_applied', 'system', '{"migration": "002_database_triggers", "description": "Applied database triggers for automatic subnet assignment and device protection"}', NOW());