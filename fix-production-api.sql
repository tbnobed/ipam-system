-- Fix the gateway for subnet 17 to match its network range
UPDATE subnets 
SET gateway = '10.63.21.1' 
WHERE id = 17 AND network = '10.63.21.0/24';

-- Verify the fix
SELECT 
    id,
    network,
    gateway,
    description
FROM subnets 
ORDER BY id;

-- Test if this resolves the API issue by checking device visibility
SELECT 
    'After gateway fix' as status,
    COUNT(*) as total_devices,
    COUNT(CASE WHEN subnet_id = 16 THEN 1 END) as subnet_16_devices,
    COUNT(CASE WHEN subnet_id = 17 THEN 1 END) as subnet_17_devices
FROM devices;