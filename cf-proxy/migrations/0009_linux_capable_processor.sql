CREATE TABLE IF NOT EXISTS linux_capable_processor (
  lcsc INTEGER PRIMARY KEY,
  mfr TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  in_stock BOOLEAN,
  package TEXT,
  manufacturer TEXT,
  chip_family TEXT,
  architecture TEXT,
  cpu_core TEXT,
  is_basic BOOLEAN,
  is_preferred BOOLEAN,
  attributes TEXT
);

CREATE INDEX IF NOT EXISTS idx_linux_capable_processor_stock
  ON linux_capable_processor (stock);
CREATE INDEX IF NOT EXISTS idx_linux_capable_processor_package_stock
  ON linux_capable_processor (package, stock);
CREATE INDEX IF NOT EXISTS idx_linux_capable_processor_manufacturer_stock
  ON linux_capable_processor (manufacturer, stock);
CREATE INDEX IF NOT EXISTS idx_linux_capable_processor_family_stock
  ON linux_capable_processor (chip_family, stock);
CREATE INDEX IF NOT EXISTS idx_linux_capable_processor_architecture_stock
  ON linux_capable_processor (architecture, stock);
CREATE INDEX IF NOT EXISTS idx_linux_capable_processor_cpu_core_stock
  ON linux_capable_processor (cpu_core, stock);
CREATE INDEX IF NOT EXISTS idx_linux_capable_processor_is_basic_stock
  ON linux_capable_processor (is_basic, stock);
CREATE INDEX IF NOT EXISTS idx_linux_capable_processor_is_preferred_stock
  ON linux_capable_processor (is_preferred, stock);
