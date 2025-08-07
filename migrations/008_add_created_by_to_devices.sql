-- Migration: Add created_by column to devices table
-- This tracks who created each device (username or "system scan")

-- Add created_by column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'devices' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE devices ADD COLUMN created_by TEXT DEFAULT 'system scan';
    -- Update existing devices to show they were created by system scan
    UPDATE devices SET created_by = 'system scan' WHERE created_by IS NULL;
    RAISE NOTICE 'Added created_by column to devices table with default value';
  ELSE
    RAISE NOTICE 'created_by column already exists in devices table';
  END IF;
END
$$;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'devices' AND column_name = 'created_by';