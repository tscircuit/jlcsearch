CREATE INDEX IF NOT EXISTS idx_capacitor_capacitance_farads
  ON capacitor (capacitance_farads);
CREATE INDEX IF NOT EXISTS idx_resistor_array_resistance
  ON resistor_array (resistance);
