CREATE TABLE IF NOT EXISTS barrel_jack (
  lcsc INTEGER PRIMARY KEY,
  mfr TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  in_stock BOOLEAN,
  package TEXT,
  connector_type TEXT,
  mounting_style TEXT,
  orientation TEXT,
  inside_diameter_mm REAL,
  outside_diameter_mm REAL,
  current_rating_a REAL,
  voltage_rating_v REAL,
  num_pins INTEGER,
  operating_temp_min REAL,
  operating_temp_max REAL,
  is_basic BOOLEAN,
  is_preferred BOOLEAN,
  attributes TEXT
);

CREATE INDEX IF NOT EXISTS idx_barrel_jack_stock
  ON barrel_jack (stock);
CREATE INDEX IF NOT EXISTS idx_barrel_jack_package_stock
  ON barrel_jack (package, stock);
CREATE INDEX IF NOT EXISTS idx_barrel_jack_mounting_style_stock
  ON barrel_jack (mounting_style, stock);
CREATE INDEX IF NOT EXISTS idx_barrel_jack_orientation_stock
  ON barrel_jack (orientation, stock);
CREATE INDEX IF NOT EXISTS idx_barrel_jack_inside_diameter_stock
  ON barrel_jack (inside_diameter_mm, stock);
CREATE INDEX IF NOT EXISTS idx_barrel_jack_outside_diameter_stock
  ON barrel_jack (outside_diameter_mm, stock);
CREATE INDEX IF NOT EXISTS idx_barrel_jack_current_rating_stock
  ON barrel_jack (current_rating_a, stock);
CREATE INDEX IF NOT EXISTS idx_barrel_jack_voltage_rating_stock
  ON barrel_jack (voltage_rating_v, stock);
CREATE INDEX IF NOT EXISTS idx_barrel_jack_num_pins_stock
  ON barrel_jack (num_pins, stock);
CREATE INDEX IF NOT EXISTS idx_barrel_jack_is_basic_stock
  ON barrel_jack (is_basic, stock);
CREATE INDEX IF NOT EXISTS idx_barrel_jack_is_preferred_stock
  ON barrel_jack (is_preferred, stock);
