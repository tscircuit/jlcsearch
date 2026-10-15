CREATE TABLE IF NOT EXISTS psram (
  lcsc INTEGER PRIMARY KEY,
  mfr TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  in_stock BOOLEAN,
  package TEXT,
  interface_type TEXT,
  memory_size_mbit REAL,
  clock_frequency_mhz REAL,
  supply_voltage_min REAL,
  supply_voltage_max REAL,
  operating_temp_min REAL,
  operating_temp_max REAL,
  is_basic BOOLEAN,
  is_preferred BOOLEAN,
  attributes TEXT
);

CREATE INDEX IF NOT EXISTS idx_psram_stock
  ON psram (stock);
CREATE INDEX IF NOT EXISTS idx_psram_package_stock
  ON psram (package, stock);
CREATE INDEX IF NOT EXISTS idx_psram_interface_type_stock
  ON psram (interface_type, stock);
CREATE INDEX IF NOT EXISTS idx_psram_memory_size_stock
  ON psram (memory_size_mbit, stock);
CREATE INDEX IF NOT EXISTS idx_psram_clock_frequency_stock
  ON psram (clock_frequency_mhz, stock);
CREATE INDEX IF NOT EXISTS idx_psram_is_basic_stock
  ON psram (is_basic, stock);
CREATE INDEX IF NOT EXISTS idx_psram_is_preferred_stock
  ON psram (is_preferred, stock);
