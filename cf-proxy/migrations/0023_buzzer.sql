CREATE TABLE IF NOT EXISTS buzzer (
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

CREATE INDEX IF NOT EXISTS idx_buzzer_stock
  ON buzzer (stock);
CREATE INDEX IF NOT EXISTS idx_buzzer_package_stock
  ON buzzer (package, stock);
