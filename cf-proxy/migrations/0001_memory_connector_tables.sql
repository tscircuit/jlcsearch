CREATE TABLE IF NOT EXISTS dimm_connector (
  lcsc INTEGER PRIMARY KEY,
  mfr TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  in_stock BOOLEAN,
  package TEXT,
  ddr_standard TEXT,
  num_pins INTEGER,
  pitch_mm REAL,
  height_above_board_mm REAL,
  mounting_type TEXT,
  operating_temp_min REAL,
  operating_temp_max REAL,
  is_right_angle BOOLEAN,
  is_basic BOOLEAN,
  is_preferred BOOLEAN,
  attributes TEXT
);

CREATE INDEX IF NOT EXISTS idx_dimm_connector_stock
  ON dimm_connector (stock);
CREATE INDEX IF NOT EXISTS idx_dimm_connector_package_stock
  ON dimm_connector (package, stock);
CREATE INDEX IF NOT EXISTS idx_dimm_connector_ddr_standard_stock
  ON dimm_connector (ddr_standard, stock);
CREATE INDEX IF NOT EXISTS idx_dimm_connector_num_pins_stock
  ON dimm_connector (num_pins, stock);
CREATE INDEX IF NOT EXISTS idx_dimm_connector_pitch_mm_stock
  ON dimm_connector (pitch_mm, stock);
CREATE INDEX IF NOT EXISTS idx_dimm_connector_height_above_board_mm_stock
  ON dimm_connector (height_above_board_mm, stock);
CREATE INDEX IF NOT EXISTS idx_dimm_connector_mounting_type_stock
  ON dimm_connector (mounting_type, stock);
CREATE INDEX IF NOT EXISTS idx_dimm_connector_is_right_angle_stock
  ON dimm_connector (is_right_angle, stock);
CREATE INDEX IF NOT EXISTS idx_dimm_connector_is_basic_stock
  ON dimm_connector (is_basic, stock);
CREATE INDEX IF NOT EXISTS idx_dimm_connector_is_preferred_stock
  ON dimm_connector (is_preferred, stock);

CREATE TABLE IF NOT EXISTS sodimm_connector (
  lcsc INTEGER PRIMARY KEY,
  mfr TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  in_stock BOOLEAN,
  package TEXT,
  ddr_standard TEXT,
  num_pins INTEGER,
  pitch_mm REAL,
  height_above_board_mm REAL,
  mounting_type TEXT,
  operating_temp_min REAL,
  operating_temp_max REAL,
  is_right_angle BOOLEAN,
  is_basic BOOLEAN,
  is_preferred BOOLEAN,
  attributes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sodimm_connector_stock
  ON sodimm_connector (stock);
CREATE INDEX IF NOT EXISTS idx_sodimm_connector_package_stock
  ON sodimm_connector (package, stock);
CREATE INDEX IF NOT EXISTS idx_sodimm_connector_ddr_standard_stock
  ON sodimm_connector (ddr_standard, stock);
CREATE INDEX IF NOT EXISTS idx_sodimm_connector_num_pins_stock
  ON sodimm_connector (num_pins, stock);
CREATE INDEX IF NOT EXISTS idx_sodimm_connector_pitch_mm_stock
  ON sodimm_connector (pitch_mm, stock);
CREATE INDEX IF NOT EXISTS idx_sodimm_connector_height_above_board_mm_stock
  ON sodimm_connector (height_above_board_mm, stock);
CREATE INDEX IF NOT EXISTS idx_sodimm_connector_mounting_type_stock
  ON sodimm_connector (mounting_type, stock);
CREATE INDEX IF NOT EXISTS idx_sodimm_connector_is_right_angle_stock
  ON sodimm_connector (is_right_angle, stock);
CREATE INDEX IF NOT EXISTS idx_sodimm_connector_is_basic_stock
  ON sodimm_connector (is_basic, stock);
CREATE INDEX IF NOT EXISTS idx_sodimm_connector_is_preferred_stock
  ON sodimm_connector (is_preferred, stock);
