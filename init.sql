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
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
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

CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- No automatic data population - database starts clean

-- Function to find correct subnet for an IP address
CREATE OR REPLACE FUNCTION find_subnet_for_ip(ip_addr TEXT)
RETURNS INTEGER AS $$
DECLARE
    subnet_record RECORD;
    ip_int BIGINT;
    network_int BIGINT;
    mask BIGINT;
    network_parts INTEGER[];
    ip_parts INTEGER[];
    cidr INTEGER;
    host_bits INTEGER;
BEGIN
    -- Parse IP address
    ip_parts := string_to_array(ip_addr, '.')::INTEGER[];
    
    -- Check if valid IPv4
    IF array_length(ip_parts, 1) != 4 THEN
        RETURN NULL;
    END IF;
    
    -- Convert IP to integer
    ip_int := (ip_parts[1]::BIGINT << 24) + (ip_parts[2]::BIGINT << 16) + (ip_parts[3]::BIGINT << 8) + ip_parts[4]::BIGINT;
    
    -- Loop through all subnets to find CIDR match (most specific first)
    FOR subnet_record IN SELECT id, network FROM subnets ORDER BY LENGTH(network) DESC LOOP
        -- Parse network and CIDR
        network_parts := string_to_array(split_part(subnet_record.network, '/', 1), '.')::INTEGER[];
        cidr := split_part(subnet_record.network, '/', 2)::INTEGER;
        host_bits := 32 - cidr;
        
        -- Convert network to integer
        network_int := (network_parts[1]::BIGINT << 24) + (network_parts[2]::BIGINT << 16) + (network_parts[3]::BIGINT << 8) + network_parts[4]::BIGINT;
        
        -- Create subnet mask
        mask := (4294967295::BIGINT << host_bits) & 4294967295::BIGINT;
        
        -- Check if IP is in this subnet using proper CIDR calculation
        IF (ip_int & mask) = (network_int & mask) THEN
            RETURN subnet_record.id;
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

-- Create admin user (password: admin123)
INSERT INTO users (username, password, role) VALUES
('admin', '$2b$10$rOzZkNm9k5/6Y5h3yZ6YHO8sxQv0.vJgXxwL7Qz8k5H6Y7j9L0mN2', 'admin')
ON CONFLICT (username) DO NOTHING;