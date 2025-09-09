/*
  # Create training_data table for ML model training

  1. New Tables
    - `training_data`
      - `id` (uuid, primary key)
      - `features` (numeric array)
      - `label` (text)
      - `source` (text)
      - `validated` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `training_data` table
    - Add policies for authenticated users to manage training data
*/

CREATE TABLE IF NOT EXISTS training_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  features numeric[] NOT NULL,
  label text NOT NULL,
  source text DEFAULT 'manual',
  validated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraint for valid sources
ALTER TABLE training_data ADD CONSTRAINT valid_source 
CHECK (source IN ('manual', 'auto', 'csv', 'api'));

-- Add constraint for valid labels
ALTER TABLE training_data ADD CONSTRAINT valid_label 
CHECK (label IN ('Normal', 'Malware', 'DDoS', 'Intrusion', 'Phishing', 'Port_Scan', 'Brute_Force'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_training_data_label ON training_data(label);
CREATE INDEX IF NOT EXISTS idx_training_data_source ON training_data(source);
CREATE INDEX IF NOT EXISTS idx_training_data_validated ON training_data(validated);
CREATE INDEX IF NOT EXISTS idx_training_data_created_at ON training_data(created_at DESC);

-- Enable Row Level Security
ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can read training data"
  ON training_data
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and analysts can insert training data"
  ON training_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'security_analyst', 'it_manager')
    )
  );

CREATE POLICY "Admins and analysts can update training data"
  ON training_data
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
CREATE TRIGGER update_training_data_updated_at
  BEFORE UPDATE ON training_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();