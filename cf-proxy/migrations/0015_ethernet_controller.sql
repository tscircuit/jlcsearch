CREATE TABLE IF NOT EXISTS ethernet_controller (
  lcsc INTEGER PRIMARY KEY,
  mfr TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  in_stock BOOLEAN,
  package TEXT,
  is_basic BOOLEAN,
  is_preferred BOOLEAN,
  attributes TEXT
);

CREATE INDEX IF NOT EXISTS idx_ethernet_controller_stock ON ethernet_controller (stock);
CREATE INDEX IF NOT EXISTS idx_ethernet_controller_package_stock ON ethernet_controller (package, stock);
CREATE INDEX IF NOT EXISTS idx_ethernet_controller_is_basic_stock ON ethernet_controller (is_basic, stock);
CREATE INDEX IF NOT EXISTS idx_ethernet_controller_is_preferred_stock ON ethernet_controller (is_preferred, stock);
