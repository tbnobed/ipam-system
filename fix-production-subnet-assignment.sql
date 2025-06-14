-- Fix production subnet assignments for existing devices
-- This script redistributes devices to correct subnets based on their IP addresses

-- First, let's see what we're working with
SELECT 
    s.id as subnet_id,
    s.name as subnet_name,
    COUNT(d.id) as device_count
FROM subnets s
LEFT JOIN devices d ON d.subnet_id = s.id
GROUP BY s.id, s.name
ORDER BY s.id;

-- Show the problem - devices with 10.63.21.x IPs incorrectly in subnet 16
SELECT 
    'Before redistribution' as status,
    subnet_id,
    COUNT(*) as count,
    MIN(ip_address) as min_ip,
    MAX(ip_address) as max_ip
FROM devices 
WHERE ip_address LIKE '10.63.21.%'
GROUP BY subnet_id;

-- Update devices in subnet 16 that should be in subnet 17
-- Subnet 16: 10.63.20.0/24 (10.63.20.1 - 10.63.20.254)
-- Subnet 17: 10.63.21.0/24 (10.63.21.1 - 10.63.21.254)

-- Move devices with 10.63.21.x IPs from subnet 16 to subnet 17
UPDATE devices 
SET subnet_id = 17
WHERE subnet_id = 16 
  AND ip_address LIKE '10.63.21.%';

-- Show the fix - devices with 10.63.21.x IPs now correctly in subnet 17
SELECT 
    'After redistribution' as status,
    subnet_id,
    COUNT(*) as count,
    MIN(ip_address) as min_ip,
    MAX(ip_address) as max_ip
FROM devices 
WHERE ip_address LIKE '10.63.21.%'
GROUP BY subnet_id;

-- Verify final distribution
SELECT 
    s.id as subnet_id,
    s.name as subnet_name,
    COUNT(d.id) as device_count,
    MIN(d.ip_address) as min_ip,
    MAX(d.ip_address) as max_ip
FROM subnets s
LEFT JOIN devices d ON d.subnet_id = s.id
WHERE s.id IN (16, 17)
GROUP BY s.id, s.name
ORDER BY s.id;