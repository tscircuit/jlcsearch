CREATE TABLE IF NOT EXISTS optical_sensor (
  lcsc INTEGER PRIMARY KEY,
  mfr TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  in_stock BOOLEAN,
  package TEXT,
  sensor_type TEXT,
  is_basic BOOLEAN,
  is_preferred BOOLEAN,
  attributes TEXT
);

CREATE INDEX IF NOT EXISTS idx_optical_sensor_stock ON optical_sensor (stock);
CREATE INDEX IF NOT EXISTS idx_optical_sensor_package_stock ON optical_sensor (package, stock);
CREATE INDEX IF NOT EXISTS idx_optical_sensor_type_stock ON optical_sensor (sensor_type, stock);
CREATE INDEX IF NOT EXISTS idx_optical_sensor_is_basic_stock ON optical_sensor (is_basic, stock);
CREATE INDEX IF NOT EXISTS idx_optical_sensor_is_preferred_stock ON optical_sensor (is_preferred, stock);
