-- Debug production subnet ID mappings
-- Check what subnet IDs actually exist and their networks

-- Show all subnets with their IDs and networks
SELECT 
    id,
    network,
    gateway,
    description
FROM subnets 
ORDER BY id;

-- Show device distribution by actual subnet IDs that exist
SELECT 
    d.subnet_id,
    s.network as subnet_network,
    COUNT(d.id) as device_count,
    MIN(d.ip_address) as min_ip,
    MAX(d.ip_address) as max_ip
FROM devices d
LEFT JOIN subnets s ON s.id = d.subnet_id
GROUP BY d.subnet_id, s.network
ORDER BY d.subnet_id;

-- Show devices with 10.63.21.x IPs and their current subnet assignments
SELECT 
    ip_address,
    subnet_id,
    status,
    last_seen
FROM devices 
WHERE ip_address LIKE '10.63.21.%'
ORDER BY ip_address
LIMIT 10;