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
  assignment_type TEXT NOT NULL DEFAULT 'dhcp',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
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
(320, 'Engineering Control', 'Engineering control network', '#ff6b35'),
(321, 'Production Equipment', 'Production equipment network', '#ff0000')
ON CONFLICT (vlan_id) DO NOTHING;

INSERT INTO subnets (id, network, gateway, vlan_id, assignment_type, description) VALUES
(19, '10.63.20.0/24', '10.63.20.1', 1, 'static', 'Engineering control subnet'),
(20, '10.63.21.0/24', '10.63.21.1', 2, 'static', 'Production equipment subnet');

-- Function to find correct subnet for an IP address
CREATE OR REPLACE FUNCTION find_subnet_for_ip(ip_addr TEXT)
RETURNS INTEGER AS $$
DECLARE
    subnet_record RECORD;
    ip_parts INTEGER[];
    network_parts INTEGER[];
    ip_prefix TEXT;
    network_prefix TEXT;
    host_octet INTEGER;
BEGIN
    -- Parse IP address
    ip_parts := string_to_array(ip_addr, '.')::INTEGER[];
    
    -- Check if valid IPv4
    IF array_length(ip_parts, 1) != 4 THEN
        RETURN NULL;
    END IF;
    
    -- Loop through all subnets to find match
    FOR subnet_record IN SELECT id, network FROM subnets LOOP
        -- Handle /24 networks with exact prefix matching
        IF subnet_record.network LIKE '%/24' THEN
            network_parts := string_to_array(split_part(subnet_record.network, '/', 1), '.')::INTEGER[];
            
            -- Compare first 3 octets
            ip_prefix := ip_parts[1] || '.' || ip_parts[2] || '.' || ip_parts[3];
            network_prefix := network_parts[1] || '.' || network_parts[2] || '.' || network_parts[3];
            
            IF ip_prefix = network_prefix THEN
                host_octet := ip_parts[4];
                -- Validate host octet (1-254 for /24)
                IF host_octet >= 1 AND host_octet <= 254 THEN
                    RETURN subnet_record.id;
                END IF;
            END IF;
        END IF;
    END LOOP;
    
    -- No match found
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-assign subnet
CREATE OR REPLACE FUNCTION auto_assign_device_subnet()
RETURNS TRIGGER AS $$
DECLARE
    correct_subnet_id INTEGER;
BEGIN
    -- Find correct subnet for the IP address
    correct_subnet_id := find_subnet_for_ip(NEW.ip_address);
    
    -- If we found a matching subnet, use it
    IF correct_subnet_id IS NOT NULL THEN
        NEW.subnet_id := correct_subnet_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
DROP TRIGGER IF EXISTS device_auto_subnet_insert ON devices;
CREATE TRIGGER device_auto_subnet_insert
    BEFORE INSERT ON devices
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_device_subnet();

-- Create trigger for UPDATE operations (only when IP address changes)
DROP TRIGGER IF EXISTS device_auto_subnet_update ON devices;
CREATE TRIGGER device_auto_subnet_update
    BEFORE UPDATE ON devices
    FOR EACH ROW
    WHEN (OLD.ip_address IS DISTINCT FROM NEW.ip_address)
    EXECUTE FUNCTION auto_assign_device_subnet();

-- Create migrations table for tracking applied migrations
CREATE TABLE IF NOT EXISTS migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Insert migration records
INSERT INTO migrations (version) VALUES 
('001_fix_subnet_assignments'),
('002_auto_subnet_assignment'),
('003_fix_assignment_type_default')
ON CONFLICT (version) DO NOTHING;

-- Create admin user (password: admin123)
INSERT INTO users (username, password, role) VALUES
('admin', '$2b$10$rOzZkNm9k5/6Y5h3yZ6YHO8sxQv0.vJgXxwL7Qz8k5H6Y7j9L0mN2', 'admin')
ON CONFLICT (username) DO NOTHING;