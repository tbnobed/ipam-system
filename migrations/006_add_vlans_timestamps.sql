-- Add timestamps to VLANs table (if they don't exist)
ALTER TABLE vlans ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE vlans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();