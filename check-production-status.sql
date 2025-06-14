-- Check production device distribution status
-- This script works with the production schema (no name column in subnets)

-- Show current device distribution by subnet
SELECT 
    s.id as subnet_id,
    s.network as subnet_network,
    COUNT(d.id) as device_count,
    MIN(d.ip_address) as min_ip,
    MAX(d.ip_address) as max_ip
FROM subnets s
LEFT JOIN devices d ON d.subnet_id = s.id
GROUP BY s.id, s.network
ORDER BY s.id;

-- Show devices with 10.63.20.x IPs (should be in subnet 16)
SELECT 
    'Devices in 10.63.20.x range' as description,
    subnet_id,
    COUNT(*) as count,
    MIN(ip_address) as min_ip,
    MAX(ip_address) as max_ip
FROM devices 
WHERE ip_address LIKE '10.63.20.%'
GROUP BY subnet_id;

-- Show devices with 10.63.21.x IPs (should be in subnet 17)
SELECT 
    'Devices in 10.63.21.x range' as description,
    subnet_id,
    COUNT(*) as count,
    MIN(ip_address) as min_ip,
    MAX(ip_address) as max_ip
FROM devices 
WHERE ip_address LIKE '10.63.21.%'
GROUP BY subnet_id;

-- Show total device count
SELECT 
    'Total devices' as description,
    COUNT(*) as total_count
FROM devices;

-- Show any misassigned devices (devices in wrong subnet)
SELECT 
    'Misassigned devices' as issue,
    d.ip_address,
    d.subnet_id as current_subnet,
    s.network as current_subnet_network,
    CASE 
        WHEN d.ip_address LIKE '10.63.20.%' THEN 'Should be in 10.63.20.0/24'
        WHEN d.ip_address LIKE '10.63.21.%' THEN 'Should be in 10.63.21.0/24'
        ELSE 'Unknown subnet'
    END as should_be_in
FROM devices d
JOIN subnets s ON s.id = d.subnet_id
WHERE (d.ip_address LIKE '10.63.20.%' AND s.network != '10.63.20.0/24')
   OR (d.ip_address LIKE '10.63.21.%' AND s.network != '10.63.21.0/24')
LIMIT 10;