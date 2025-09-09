/*
  # Create threats table for cybersecurity system

  1. New Tables
    - `threats`
      - `id` (uuid, primary key)
      - `timestamp` (timestamptz)
      - `type` (text)
      - `severity` (text with enum constraint)
      - `source_ip` (inet)
      - `destination_ip` (inet)
      - `source_port` (integer)
      - `destination_port` (integer)
      - `protocol` (text)
      - `packet_size` (integer)
      - `description` (text)
      - `classification` (text)
      - `confidence` (numeric)
      - `status` (text with enum constraint)
      - `location` (text)
      - `network_interface` (text)
      - `raw_packet_data` (jsonb)
      - `features` (numeric array)
      - `alert_sent` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `threats` table
    - Add policies for authenticated users to read threats
*/

CREATE TABLE IF NOT EXISTS threats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL,
  severity text NOT NULL,
  source_ip inet,
  destination_ip inet,
  source_port integer,
  destination_port integer,
  protocol text,
  packet_size integer,
  description text NOT NULL,
  classification text NOT NULL,
  confidence numeric(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status text NOT NULL DEFAULT 'active',
  location text,
  network_interface text,
  raw_packet_data jsonb,
  features numeric[],
  alert_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints for valid values
ALTER TABLE threats ADD CONSTRAINT valid_severity 
CHECK (severity IN ('Critical', 'High', 'Medium', 'Low'));

ALTER TABLE threats ADD CONSTRAINT valid_status 
CHECK (status IN ('active', 'investigating', 'resolved', 'false_positive'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_threats_timestamp ON threats(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_threats_severity ON threats(severity);
CREATE INDEX IF NOT EXISTS idx_threats_status ON threats(status);
CREATE INDEX IF NOT EXISTS idx_threats_source_ip ON threats(source_ip);
CREATE INDEX IF NOT EXISTS idx_threats_destination_ip ON threats(destination_ip);
CREATE INDEX IF NOT EXISTS idx_threats_type ON threats(type);

-- Enable Row Level Security
ALTER TABLE threats ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can read threats"
  ON threats
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert threats"
  ON threats
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Analysts can update threats"
  ON threats
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'security_analyst', 'it_manager')
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_threats_updated_at
  BEFORE UPDATE ON threats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();