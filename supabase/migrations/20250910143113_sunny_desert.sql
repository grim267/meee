/*
  # Fix User Role Constraints

  1. Database Changes
    - Update role constraint to accept correct role values
    - Fix role level mapping
    - Ensure proper user creation

  2. Security
    - Maintain RLS policies
    - Keep existing permissions
*/

-- Drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;

-- Add the correct constraint with proper role values
ALTER TABLE users ADD CONSTRAINT valid_role 
  CHECK (role IN ('security_admin', 'security_manager', 'security_analyst', 'security_viewer'));

-- Update role_level constraint to match the correct mapping
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role_level;
ALTER TABLE users ADD CONSTRAINT valid_role_level 
  CHECK (role_level >= 1 AND role_level <= 4);

-- Ensure alert_preferences has a proper default
ALTER TABLE users ALTER COLUMN alert_preferences SET DEFAULT '{"emailEnabled": true, "severityLevels": ["Critical", "High"], "threatTypes": ["Malware", "DDoS", "Intrusion", "Phishing", "Port_Scan", "Brute_Force"], "immediateAlert": true, "dailySummary": true, "weeklySummary": false}'::jsonb;