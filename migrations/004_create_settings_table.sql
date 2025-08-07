-- Migration: Create settings table with default values
-- Version: 004
-- Description: Create settings table for system configuration

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
  ('scan_interval', '5', 'Network scan interval in minutes'),
  ('ping_timeout', '2', 'Ping timeout in seconds'),
  ('auto_discovery', 'true', 'Enable automatic device discovery'),
  ('port_scanning', 'false', 'Scan common ports during discovery'),
  ('device_alerts', 'true', 'Alert when devices go offline'),
  ('subnet_alerts', 'true', 'Alert when subnet utilization exceeds threshold'),
  ('alert_threshold', '90', 'Utilization alert threshold percentage'),
  ('data_retention', '90', 'Data retention period in days')
ON CONFLICT (key) DO NOTHING;