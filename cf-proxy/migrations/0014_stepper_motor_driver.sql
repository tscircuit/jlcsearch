CREATE TABLE IF NOT EXISTS stepper_motor_driver (
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

CREATE INDEX IF NOT EXISTS idx_stepper_motor_driver_stock
  ON stepper_motor_driver (stock);
CREATE INDEX IF NOT EXISTS idx_stepper_motor_driver_package_stock
  ON stepper_motor_driver (package, stock);
