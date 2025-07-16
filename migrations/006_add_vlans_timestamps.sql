-- Add timestamps to VLANs table
ALTER TABLE vlans ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE vlans ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

-- Mark this migration as applied
INSERT INTO migrations (version, name, applied_at) VALUES ('006', '006_add_vlans_timestamps.sql', NOW());