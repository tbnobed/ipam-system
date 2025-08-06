-- Force fix for production subnet assignments
-- Uses dynamic subnet lookup instead of hardcoded IDs

-- Update all devices to use correct subnet based on their IP addresses
DO $$
DECLARE
    device_record RECORD;
    correct_subnet_id INTEGER;
    corrections_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Fixing all device subnet assignments using dynamic lookup...';
    
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

-- Show the results
SELECT 
  subnet_id,
  COUNT(*) as device_count,
  MIN(ip_address) as first_ip,
  MAX(ip_address) as last_ip
FROM devices 
GROUP BY subnet_id 
ORDER BY subnet_id;