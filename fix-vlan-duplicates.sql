-- Fix duplicate VLAN constraint issues in production
-- This script safely handles duplicate VLAN IDs without data loss

-- First, check for existing VLAN ID 3170
DO $$
BEGIN
    -- If VLAN 3170 exists, report it
    IF EXISTS (SELECT 1 FROM vlans WHERE vlan_id = 3170) THEN
        RAISE NOTICE 'VLAN ID 3170 already exists in database:';
        RAISE NOTICE 'Details: %', (SELECT row_to_json(v) FROM vlans v WHERE vlan_id = 3170);
    ELSE
        RAISE NOTICE 'VLAN ID 3170 does not exist - safe to create';
    END IF;
END $$;

-- Check for any other potential VLAN ID conflicts
SELECT 
    vlan_id,
    COUNT(*) as count,
    array_agg(name) as names,
    array_agg(id) as internal_ids
FROM vlans 
GROUP BY vlan_id 
HAVING COUNT(*) > 1
ORDER BY vlan_id;

-- Show current VLAN count and ID range
SELECT 
    COUNT(*) as total_vlans,
    MIN(vlan_id) as min_vlan_id,
    MAX(vlan_id) as max_vlan_id
FROM vlans;

-- List all VLANs sorted by VLAN ID to see the full picture
SELECT id, vlan_id, name, created_at 
FROM vlans 
ORDER BY vlan_id;