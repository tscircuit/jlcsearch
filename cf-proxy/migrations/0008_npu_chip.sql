CREATE TABLE IF NOT EXISTS npu_chip (
  lcsc INTEGER PRIMARY KEY,
  mfr TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  in_stock BOOLEAN,
  package TEXT,
  manufacturer TEXT,
  chip_family TEXT,
  npu_name TEXT,
  npu_performance_tops REAL,
  is_basic BOOLEAN,
  is_preferred BOOLEAN,
  attributes TEXT
);

CREATE INDEX IF NOT EXISTS idx_npu_chip_stock
  ON npu_chip (stock);
CREATE INDEX IF NOT EXISTS idx_npu_chip_package_stock
  ON npu_chip (package, stock);
CREATE INDEX IF NOT EXISTS idx_npu_chip_manufacturer_stock
  ON npu_chip (manufacturer, stock);
CREATE INDEX IF NOT EXISTS idx_npu_chip_family_stock
  ON npu_chip (chip_family, stock);
CREATE INDEX IF NOT EXISTS idx_npu_chip_npu_name_stock
  ON npu_chip (npu_name, stock);
CREATE INDEX IF NOT EXISTS idx_npu_chip_performance_stock
  ON npu_chip (npu_performance_tops, stock);
CREATE INDEX IF NOT EXISTS idx_npu_chip_is_basic_stock
  ON npu_chip (is_basic, stock);
CREATE INDEX IF NOT EXISTS idx_npu_chip_is_preferred_stock
  ON npu_chip (is_preferred, stock);
