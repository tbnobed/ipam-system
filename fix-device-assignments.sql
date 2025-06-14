-- Fix device subnet assignments based on IP address ranges
-- This script will properly assign devices to their correct subnets

-- First, let's see the current subnet configuration
SELECT s.id, s.network, COUNT(d.id) as device_count 
FROM subnets s 
LEFT JOIN devices d ON s.id = d.subnet_id 
GROUP BY s.id, s.network 
ORDER BY s.id;

-- Update devices to correct subnets based on IP ranges
-- 10.63.20.x should go to the 10.63.20.0/24 subnet
UPDATE devices 
SET subnet_id = (SELECT id FROM subnets WHERE network = '10.63.20.0/24' LIMIT 1)
WHERE ip_address LIKE '10.63.20.%';

-- 10.63.21.x should go to the 10.63.21.0/24 subnet  
UPDATE devices 
SET subnet_id = (SELECT id FROM subnets WHERE network = '10.63.21.0/24' LIMIT 1)
WHERE ip_address LIKE '10.63.21.%';

-- 10.63.250.x should go to the 10.63.250.0/24 subnet
UPDATE devices 
SET subnet_id = (SELECT id FROM subnets WHERE network = '10.63.250.0/24' LIMIT 1)
WHERE ip_address LIKE '10.63.250.%';

-- 10.63.251.x should go to the 10.63.251.0/24 subnet
UPDATE devices 
SET subnet_id = (SELECT id FROM subnets WHERE network = '10.63.251.0/24' LIMIT 1)
WHERE ip_address LIKE '10.63.251.%';

-- Verify the fix
SELECT s.id, s.network, COUNT(d.id) as device_count 
FROM subnets s 
LEFT JOIN devices d ON s.id = d.subnet_id 
GROUP BY s.id, s.network 
ORDER BY s.id;