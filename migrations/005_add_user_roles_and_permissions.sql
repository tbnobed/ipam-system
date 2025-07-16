-- Migration: Add user roles and permissions system
-- Version: 005
-- Description: Add role-based access control with user permissions for VLANs and subnets

-- Add role and status columns to users table
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'viewer' NOT NULL CHECK (role IN ('admin', 'user', 'viewer'));
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

-- Create user permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  vlan_id INTEGER REFERENCES vlans(id) ON DELETE CASCADE,
  subnet_id INTEGER REFERENCES subnets(id) ON DELETE CASCADE,
  permission TEXT DEFAULT 'read' NOT NULL CHECK (permission IN ('read', 'write', 'admin')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_vlan_id ON user_permissions(vlan_id);
CREATE INDEX idx_user_permissions_subnet_id ON user_permissions(subnet_id);

-- Create default admin user (you can change this later)
INSERT INTO users (username, password, role) VALUES ('admin', 'admin', 'admin') ON CONFLICT (username) DO UPDATE SET role = 'admin';

-- Update existing users to have viewer role by default
UPDATE users SET role = 'viewer' WHERE role IS NULL;