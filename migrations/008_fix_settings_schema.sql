-- Migration: Fix settings table schema
-- Version: 008
-- Description: Add created_at column to settings table if it doesn't exist

-- Add created_at column to settings table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'created_at') THEN
        ALTER TABLE settings ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
        -- Update existing records to have created_at = updated_at
        UPDATE settings SET created_at = updated_at WHERE created_at IS NULL;
    END IF;
END $$;