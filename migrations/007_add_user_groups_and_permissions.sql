-- Migration 007: Add user groups and group permissions tables
-- This migration adds support for user groups and group-based permissions

-- Create user_groups table
CREATE TABLE IF NOT EXISTS user_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'user', 'viewer')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create group_permissions table
CREATE TABLE IF NOT EXISTS group_permissions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  vlan_id INTEGER REFERENCES vlans(id) ON DELETE CASCADE,
  subnet_id INTEGER REFERENCES subnets(id) ON DELETE CASCADE,
  permission VARCHAR(50) NOT NULL CHECK (permission IN ('view', 'write', 'admin')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure at least one of vlan_id or subnet_id is set
  CONSTRAINT check_vlan_or_subnet CHECK (
    (vlan_id IS NOT NULL AND subnet_id IS NULL) OR 
    (vlan_id IS NULL AND subnet_id IS NOT NULL)
  ),
  
  -- Unique constraint to prevent duplicate permissions
  UNIQUE (group_id, vlan_id, subnet_id)
);

-- Add group_id column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE users ADD COLUMN group_id INTEGER REFERENCES user_groups(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_permissions_group_id ON group_permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_permissions_vlan_id ON group_permissions(vlan_id);
CREATE INDEX IF NOT EXISTS idx_group_permissions_subnet_id ON group_permissions(subnet_id);
CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id);

-- Insert default Engineering group if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_groups WHERE name = 'Engineering') THEN
    INSERT INTO user_groups (name, description, role, created_at, updated_at)
    VALUES ('Engineering', 'Default engineering group with network access', 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;
END
$$;

-- Log the migration (only if users table has records)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users LIMIT 1) THEN
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, timestamp)
    VALUES (1, 'migration', 'system', 7, 
      '{"message": "Added user groups and group permissions tables", "migration": "007_add_user_groups_and_permissions.sql"}',
      CURRENT_TIMESTAMP);
  ELSE
    -- Log without user_id if no users exist yet
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, timestamp)
    VALUES (NULL, 'migration', 'system', 7, 
      '{"message": "Added user groups and group permissions tables", "migration": "007_add_user_groups_and_permissions.sql"}',
      CURRENT_TIMESTAMP);
  END IF;
END $$;