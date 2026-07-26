CREATE TABLE IF NOT EXISTS hdmi_port (
  lcsc INTEGER PRIMARY KEY,
  mfr TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  in_stock BOOLEAN,
  package TEXT,
  mounting_style TEXT,
  orientation TEXT,
  gender TEXT,
  number_of_pins INTEGER,
  number_of_rows INTEGER,
  current_rating_a REAL,
  operating_temp_min REAL,
  operating_temp_max REAL,
  is_basic BOOLEAN,
  is_preferred BOOLEAN,
  attributes TEXT
);

CREATE INDEX IF NOT EXISTS idx_hdmi_port_stock
  ON hdmi_port (stock);
CREATE INDEX IF NOT EXISTS idx_hdmi_port_package_stock
  ON hdmi_port (package, stock);
CREATE INDEX IF NOT EXISTS idx_hdmi_port_mounting_style_stock
  ON hdmi_port (mounting_style, stock);
CREATE INDEX IF NOT EXISTS idx_hdmi_port_orientation_stock
  ON hdmi_port (orientation, stock);
CREATE INDEX IF NOT EXISTS idx_hdmi_port_gender_stock
  ON hdmi_port (gender, stock);
CREATE INDEX IF NOT EXISTS idx_hdmi_port_number_of_pins_stock
  ON hdmi_port (number_of_pins, stock);
CREATE INDEX IF NOT EXISTS idx_hdmi_port_is_basic_stock
  ON hdmi_port (is_basic, stock);
CREATE INDEX IF NOT EXISTS idx_hdmi_port_is_preferred_stock
  ON hdmi_port (is_preferred, stock);
