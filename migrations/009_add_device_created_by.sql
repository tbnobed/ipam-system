-- Migration 009: Add created_by column to devices table
-- This column tracks who added each device (username or "system scan")

ALTER TABLE devices ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'system scan';

-- Update existing devices to show they were added by system scan
UPDATE devices SET created_by = 'system scan' WHERE created_by IS NULL;