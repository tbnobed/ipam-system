-- Initialize database schema and sample data for IPAM system

-- Create tables
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS vlans (
  id SERIAL PRIMARY KEY,
  vlan_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  cable_color TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS subnets (
  id SERIAL PRIMARY KEY,
  network TEXT NOT NULL,
  gateway TEXT NOT NULL,
  vlan_id INTEGER REFERENCES vlans(id),
  assignment_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  hostname TEXT,
  mac_address TEXT,
  vendor TEXT,
  device_type TEXT,
  purpose TEXT,
  location TEXT,
  subnet_id INTEGER REFERENCES subnets(id),
  status TEXT NOT NULL DEFAULT 'unknown',
  last_seen TIMESTAMP,
  open_ports TEXT[],
  assignment_type TEXT NOT NULL DEFAULT 'static',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS network_scans (
  id SERIAL PRIMARY KEY,
  subnet_id INTEGER REFERENCES subnets(id),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  devices_found INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  results JSONB
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Insert sample data
INSERT INTO vlans (vlan_id, name, description, cable_color) VALUES
(100, 'Production', 'Main production network for cameras and equipment', '#FF0000'),
(200, 'Management', 'Network management and monitoring interfaces', '#00FF00'),
(300, 'Storage', 'Storage and backup network for media files', '#0000FF'),
(400, 'Audio', 'Audio equipment and mixing consoles', '#FFA500')
ON CONFLICT (vlan_id) DO NOTHING;

INSERT INTO subnets (network, gateway, vlan_id, assignment_type, description) VALUES
('192.168.100.0/24', '192.168.100.1', 1, 'static', 'Production cameras and equipment'),
('192.168.200.0/24', '192.168.200.1', 2, 'dhcp', 'Management interfaces'),
('192.168.300.0/24', '192.168.300.1', 3, 'static', 'Storage network for media files'),
('192.168.400.0/24', '192.168.400.1', 4, 'static', 'Audio equipment network');

INSERT INTO devices (ip_address, hostname, device_type, location, subnet_id, status, assignment_type, purpose) VALUES
('192.168.100.10', 'cam-studio-a-01', 'Camera', 'Studio A - Position 1', 1, 'online', 'static', 'Primary production camera'),
('192.168.100.11', 'cam-studio-a-02', 'Camera', 'Studio A - Position 2', 1, 'online', 'static', 'Secondary production camera'),
('192.168.100.12', 'cam-studio-b-01', 'Camera', 'Studio B - Position 1', 1, 'online', 'static', 'Studio B main camera'),
('192.168.100.20', 'switch-studio-a', 'Switch', 'Studio A - Rack 1', 1, 'online', 'static', 'Main network switch'),
('192.168.100.21', 'switch-studio-b', 'Switch', 'Studio B - Rack 1', 1, 'online', 'static', 'Studio B network switch'),
('192.168.200.50', 'mgmt-server-01', 'Server', 'Control Room - Rack 2', 2, 'online', 'static', 'Network management server'),
('192.168.200.51', 'monitor-display', 'Monitor', 'Control Room - Wall Mount', 2, 'online', 'dhcp', 'Status monitoring display'),
('192.168.300.100', 'storage-nas-01', 'Storage', 'Server Room - Rack 3', 3, 'online', 'static', 'Primary NAS storage'),
('192.168.300.101', 'storage-backup', 'Storage', 'Server Room - Rack 3', 3, 'online', 'static', 'Backup storage system'),
('192.168.400.10', 'audio-mixer-01', 'Audio', 'Studio A - Console', 4, 'online', 'static', 'Digital audio mixer'),
('192.168.400.11', 'audio-router', 'Audio', 'Equipment Room', 4, 'online', 'static', 'Audio signal router'),
('192.168.100.15', 'cam-spare-01', 'Camera', 'Equipment Storage', 1, 'offline', 'static', 'Spare production camera');

-- Create admin user (password: admin123)
INSERT INTO users (username, password, role) VALUES
('admin', '$2b$10$rOzZkNm9k5/6Y5h3yZ6YHO8sxQv0.vJgXxwL7Qz8k5H6Y7j9L0mN2', 'admin')
ON CONFLICT (username) DO NOTHING;