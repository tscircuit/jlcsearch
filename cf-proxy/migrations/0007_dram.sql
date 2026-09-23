CREATE TABLE IF NOT EXISTS dram (
  lcsc INTEGER PRIMARY KEY,
  mfr TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  in_stock BOOLEAN,
  package TEXT,
  memory_type TEXT,
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

CREATE INDEX IF NOT EXISTS idx_dram_stock
  ON dram (stock);
CREATE INDEX IF NOT EXISTS idx_dram_package_stock
  ON dram (package, stock);
CREATE INDEX IF NOT EXISTS idx_dram_memory_type_stock
  ON dram (memory_type, stock);
CREATE INDEX IF NOT EXISTS idx_dram_memory_size_stock
  ON dram (memory_size_mbit, stock);
CREATE INDEX IF NOT EXISTS idx_dram_clock_frequency_stock
  ON dram (clock_frequency_mhz, stock);
CREATE INDEX IF NOT EXISTS idx_dram_is_basic_stock
  ON dram (is_basic, stock);
CREATE INDEX IF NOT EXISTS idx_dram_is_preferred_stock
  ON dram (is_preferred, stock);
