-- Add test devices to verify the API works regardless of IP schema
INSERT INTO devices (ip_address, hostname, mac_address, vendor, device_type, status, subnet_id, last_seen, created_at, updated_at)
VALUES 
  ('10.63.20.100', 'test-camera-20-100', '00:11:22:33:44:55', 'Sony', 'Camera', 'online', 19, NOW(), NOW(), NOW()),
  ('10.63.20.101', 'test-switch-20-101', '00:11:22:33:44:56', 'Cisco', 'Network Switch', 'online', 19, NOW(), NOW(), NOW()),
  ('10.63.21.100', 'test-camera-21-100', '00:11:22:33:44:57', 'Panasonic', 'Camera', 'online', 19, NOW(), NOW(), NOW()),
  ('10.63.21.101', 'test-router-21-101', '00:11:22:33:44:58', 'Netgear', 'Router', 'online', 19, NOW(), NOW(), NOW()),
  ('192.168.1.10', 'test-server-192', '00:11:22:33:44:59', 'Dell', 'Server', 'online', 19, NOW(), NOW(), NOW());