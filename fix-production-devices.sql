-- Fix device subnet assignments in production database
-- This script redistributes devices to correct subnets based on IP addresses

-- First, show current distribution
SELECT 
    s.id as subnet_id,
    s.network,
    COUNT(d.id) as device_count
FROM subnets s 
LEFT JOIN devices d ON s.id = d.subnet_id 
GROUP BY s.id, s.network 
ORDER BY s.id;

-- Update devices in 10.63.21.x range to subnet 17
UPDATE devices 
SET subnet_id = 17 
WHERE ip_address LIKE '10.63.21.%' 
AND subnet_id != 17;

-- Show updated distribution
SELECT 
    s.id as subnet_id,
    s.network,
    COUNT(d.id) as device_count
FROM subnets s 
LEFT JOIN devices d ON s.id = d.subnet_id 
GROUP BY s.id, s.network 
ORDER BY s.id;

-- Verify specific device assignments
SELECT ip_address, subnet_id 
FROM devices 
WHERE ip_address LIKE '10.63.21.%' 
LIMIT 10;