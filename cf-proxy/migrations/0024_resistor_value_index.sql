-- Value lookups filter on a narrow resistance range; without an index each
-- one scans and sorts the whole table.
CREATE INDEX IF NOT EXISTS idx_resistor_resistance
  ON resistor (resistance);
