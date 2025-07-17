-- Migration 005: Create user groups and group permissions tables
-- Applied: 2025-01-16

-- Create user groups table
CREATE TABLE IF NOT EXISTS user_groups (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create group permissions table
CREATE TABLE IF NOT EXISTS group_permissions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES user_groups(id) ON DELETE CASCADE NOT NULL,
  vlan_id INTEGER REFERENCES vlans(id) ON DELETE CASCADE,
  subnet_id INTEGER REFERENCES subnets(id) ON DELETE CASCADE,
  permission TEXT CHECK (permission IN ('read', 'write', 'admin')) DEFAULT 'read' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create group memberships table
CREATE TABLE IF NOT EXISTS group_memberships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  group_id INTEGER REFERENCES user_groups(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, group_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_permissions_group_id ON group_permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_permissions_vlan_id ON group_permissions(vlan_id);
CREATE INDEX IF NOT EXISTS idx_group_permissions_subnet_id ON group_permissions(subnet_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user_id ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group_id ON group_memberships(group_id);

-- Insert default groups
INSERT INTO user_groups (name, description, is_active) VALUES
  ('Network Administrators', 'Full access to all network resources', true),
  ('Device Managers', 'Read/write access to devices and subnets', true),
  ('Viewers', 'Read-only access to network resources', true)
ON CONFLICT (name) DO NOTHING;

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_groups_updated_at BEFORE UPDATE ON user_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_group_permissions_updated_at BEFORE UPDATE ON group_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();