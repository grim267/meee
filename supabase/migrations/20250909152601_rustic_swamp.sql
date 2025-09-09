/*
  # Update training data table for new CSV format

  1. Changes
    - Drop existing training_data table
    - Create new table with proper columns for CSV format
    - Add indexes for performance
    - Update RLS policies

  2. New Schema
    - source_ip, dest_ip (text)
    - source_port, dest_port (integer)
    - protocol (text)
    - packet_size (integer)
    - duration (numeric)
    - threat_type (text with constraints)
    - processed_features (numeric array for ML)
*/

-- Drop existing table and recreate with new format
DROP TABLE IF EXISTS training_data CASCADE;

CREATE TABLE training_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ip text NOT NULL,
  dest_ip text NOT NULL,
  source_port integer NOT NULL CHECK (source_port >= 0 AND source_port <= 65535),
  dest_port integer NOT NULL CHECK (dest_port >= 0 AND dest_port <= 65535),
  protocol text NOT NULL CHECK (protocol IN ('TCP', 'UDP', 'ICMP')),
  packet_size integer NOT NULL CHECK (packet_size > 0),
  duration numeric NOT NULL DEFAULT 0 CHECK (duration >= 0),
  threat_type text NOT NULL CHECK (threat_type IN ('Normal', 'Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force')),
  processed_features numeric[] NOT NULL, -- ML features extracted from raw data
  source text DEFAULT 'csv',
  validated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_training_data_threat_type ON training_data (threat_type);
CREATE INDEX idx_training_data_protocol ON training_data (protocol);
CREATE INDEX idx_training_data_source_ip ON training_data (source_ip);
CREATE INDEX idx_training_data_created_at ON training_data (created_at DESC);

-- Enable RLS
ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Authenticated users can read training data"
  ON training_data
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert training data"
  ON training_data
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_training_data_updated_at
    BEFORE UPDATE ON training_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();