-- Fix assignment_type column to have proper default value
ALTER TABLE subnets ALTER COLUMN assignment_type SET DEFAULT 'dhcp';

-- Update any existing NULL values
UPDATE subnets SET assignment_type = 'dhcp' WHERE assignment_type IS NULL;