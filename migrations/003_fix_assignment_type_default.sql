-- Add assignment_type column to subnets table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subnets' AND column_name = 'assignment_type') THEN
        ALTER TABLE subnets ADD COLUMN assignment_type TEXT DEFAULT 'dhcp';
    ELSE
        -- Fix assignment_type column to have proper default value
        ALTER TABLE subnets ALTER COLUMN assignment_type SET DEFAULT 'dhcp';
    END IF;
END $$;

-- Update any existing NULL values
UPDATE subnets SET assignment_type = 'dhcp' WHERE assignment_type IS NULL;