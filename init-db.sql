-- Clean database initialization script
-- This ensures a consistent state on container restart

-- Drop existing tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS network_scans CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS subnets CASCADE;
DROP TABLE IF EXISTS vlans CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create vlans table
CREATE TABLE vlans (
    id SERIAL PRIMARY KEY,
    vlan_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    cable_color TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create subnets table
CREATE TABLE subnets (
    id SERIAL PRIMARY KEY,
    network TEXT NOT NULL,
    gateway TEXT NOT NULL,
    vlan_id INTEGER REFERENCES vlans(id) ON DELETE CASCADE,
    assignment_type TEXT NOT NULL DEFAULT 'static',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create devices table
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    ip_address TEXT NOT NULL,
    hostname TEXT,
    mac_address TEXT,
    vendor TEXT,
    device_type TEXT,
    purpose TEXT,
    location TEXT,
    subnet_id INTEGER REFERENCES subnets(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'unknown',
    last_seen TIMESTAMP,
    open_ports TEXT[],
    assignment_type TEXT NOT NULL DEFAULT 'static',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create network_scans table
CREATE TABLE network_scans (
    id SERIAL PRIMARY KEY,
    subnet_id INTEGER REFERENCES subnets(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    devices_found INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running',
    results JSONB
);

-- Create activity_logs table
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details JSONB,
    timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Insert default data
INSERT INTO vlans (vlan_id, name, description) VALUES 
    (320, 'Plex Engineering Control', 'Engineering control network'),
    (321, 'Production Network', 'Production equipment network')
ON CONFLICT (vlan_id) DO NOTHING;

INSERT INTO subnets (network, gateway, vlan_id, assignment_type, description) VALUES 
    ('10.63.20.0/24', '10.63.20.1', 1, 'static', 'Engineering control subnet'),
    ('10.63.21.0/22', '10.63.21.1', 2, 'static', 'Production equipment subnet')
ON CONFLICT DO NOTHING;