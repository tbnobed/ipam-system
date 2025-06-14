-- Fix subnet assignments for 10.63.20.x and 10.63.21.x devices
-- This script corrects existing devices with wrong subnet assignments

-- First, let's see what we're working with
SELECT 'Current device distribution:' as info;
SELECT 
  subnet_id,
  COUNT(*) as total_devices,
  COUNT(CASE WHEN ip_address LIKE '10.63.20.%' THEN 1 END) as devices_20_x,
  COUNT(CASE WHEN ip_address LIKE '10.63.21.%' THEN 1 END) as devices_21_x
FROM devices 
GROUP BY subnet_id;

-- Show available subnets
SELECT 'Available subnets:' as info;
SELECT id, network FROM subnets ORDER BY network;

-- Fix 10.63.20.x devices - assign to correct subnet
UPDATE devices 
SET subnet_id = (SELECT id FROM subnets WHERE network = '10.63.20.0/24' LIMIT 1)
WHERE ip_address LIKE '10.63.20.%' 
  AND subnet_id != (SELECT id FROM subnets WHERE network = '10.63.20.0/24' LIMIT 1);

-- Fix 10.63.21.x devices - assign to correct subnet  
UPDATE devices 
SET subnet_id = (SELECT id FROM subnets WHERE network = '10.63.21.0/24' LIMIT 1)
WHERE ip_address LIKE '10.63.21.%'
  AND subnet_id != (SELECT id FROM subnets WHERE network = '10.63.21.0/24' LIMIT 1);

-- Show final distribution
SELECT 'Fixed device distribution:' as info;
SELECT 
  subnet_id,
  COUNT(*) as total_devices,
  COUNT(CASE WHEN ip_address LIKE '10.63.20.%' THEN 1 END) as devices_20_x,
  COUNT(CASE WHEN ip_address LIKE '10.63.21.%' THEN 1 END) as devices_21_x
FROM devices 
GROUP BY subnet_id;

-- Show sample devices from each subnet
SELECT 'Sample devices after fix:' as info;
SELECT ip_address, subnet_id, status FROM devices 
WHERE ip_address LIKE '10.63.20.%' OR ip_address LIKE '10.63.21.%'
ORDER BY ip_address LIMIT 20;