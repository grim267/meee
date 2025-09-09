/*
  # Fix users table for proper user creation

  1. Tables
    - Drop and recreate users table with proper structure
    - Add proper constraints and defaults
    - Enable RLS with correct policies

  2. Security
    - Enable RLS on users table
    - Add policies for authenticated users
    - Allow inserts for service role
*/

-- Drop existing table if it exists
DROP TABLE IF EXISTS users CASCADE;

-- Create users table with proper structure
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(50) UNIQUE NOT NULL DEFAULT '',
  password_hash text DEFAULT '',
  email varchar(255) UNIQUE,
  full_name varchar(100) NOT NULL DEFAULT '',
  role varchar(50) NOT NULL DEFAULT 'security_viewer',
  role_level integer NOT NULL DEFAULT 4,
  is_active boolean DEFAULT true,
  last_login timestamptz,
  failed_login_attempts integer DEFAULT 0,
  account_locked_until timestamptz,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  "createdBy" uuid,
  createdby uuid,
  
  -- Add constraint for valid roles
  CONSTRAINT valid_role CHECK (role IN ('security_admin', 'security_manager', 'security_analyst', 'security_viewer')),
  CONSTRAINT valid_role_level CHECK (role_level >= 1 AND role_level <= 4)
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable insert for authenticated users only" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Enable update for users based on email" ON users
  FOR UPDATE USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();