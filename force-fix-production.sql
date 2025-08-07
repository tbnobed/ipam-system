-- Force fix for production subnet assignments
-- This directly updates device subnet assignments without relying on functions

-- Update devices in 10.63.21.x range to subnet 1
UPDATE devices 
SET subnet_id = 1 
WHERE ip_address LIKE '10.63.21.%' 
  AND subnet_id != 1;

-- Update devices in 10.63.20.x range to subnet 2  
UPDATE devices 
SET subnet_id = 2 
WHERE ip_address LIKE '10.63.20.%' 
  AND subnet_id != 2;

-- Show the results
SELECT 
  subnet_id,
  COUNT(*) as device_count,
  MIN(ip_address) as first_ip,
  MAX(ip_address) as last_ip
FROM devices 
GROUP BY subnet_id 
ORDER BY subnet_id;