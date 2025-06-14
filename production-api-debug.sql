-- Debug API query to identify why subnet 17 devices aren't returned

-- Check if there are any NULL or invalid subnet references
SELECT 
    'Devices with NULL subnet_id' as issue,
    COUNT(*) as count
FROM devices 
WHERE subnet_id IS NULL;

-- Check if subnet 17 exists and is properly referenced
SELECT 
    'Subnet 17 exists' as check_type,
    EXISTS(SELECT 1 FROM subnets WHERE id = 17) as exists;

-- Check devices that reference non-existent subnets
SELECT 
    'Devices with invalid subnet_id' as issue,
    d.subnet_id,
    COUNT(*) as count
FROM devices d
LEFT JOIN subnets s ON s.id = d.subnet_id
WHERE s.id IS NULL
GROUP BY d.subnet_id;

-- Test the exact query the API would run (simplified version)
SELECT 
    'API query simulation' as test,
    COUNT(*) as total_devices
FROM devices d
ORDER BY d.ip_address
LIMIT 200;

-- Check if ordering by ip_address affects subnet 17 visibility
SELECT 
    'First 10 devices by IP order' as test,
    ip_address,
    subnet_id
FROM devices 
ORDER BY ip_address
LIMIT 10;

-- Check last 10 devices by IP order  
SELECT 
    'Last 10 devices by IP order' as test,
    ip_address,
    subnet_id
FROM devices 
ORDER BY ip_address DESC
LIMIT 10;