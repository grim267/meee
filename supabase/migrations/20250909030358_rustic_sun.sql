/*
  # Create alerts table for cybersecurity system

  1. New Tables
    - `alerts`
      - `id` (uuid, primary key)
      - `threat_id` (uuid, foreign key to threats)
      - `threat_data` (jsonb)
      - `timestamp` (timestamptz)
      - `acknowledged` (boolean)
      - `acknowledged_by` (text)
      - `acknowledged_at` (timestamptz)
      - `assigned_to` (text)
      - `notes` (text)
      - `email_sent` (boolean)
      - `escalated` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `alerts` table
    - Add policies for authenticated users to manage alerts
*/

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  threat_id uuid REFERENCES threats(id) ON DELETE CASCADE,
  threat_data jsonb NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  acknowledged boolean DEFAULT false,
  acknowledged_by text,
  acknowledged_at timestamptz,
  assigned_to text,
  notes text,
  email_sent boolean DEFAULT false,
  escalated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_threat_id ON alerts(threat_id);
CREATE INDEX IF NOT EXISTS idx_alerts_assigned_to ON alerts(assigned_to);

-- Enable Row Level Security
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can read alerts"
  ON alerts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert alerts"
  ON alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update alerts"
  ON alerts
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();