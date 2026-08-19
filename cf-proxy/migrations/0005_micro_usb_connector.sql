CREATE TABLE IF NOT EXISTS micro_usb_connector (
  lcsc INTEGER PRIMARY KEY,
  mfr TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  in_stock BOOLEAN,
  package TEXT,
  connector_type TEXT,
  usb_standard TEXT,
  mounting_style TEXT,
  current_rating_a REAL,
  number_of_ports INTEGER,
  number_of_contacts INTEGER,
  gender TEXT,
  operating_temp_min REAL,
  operating_temp_max REAL,
  is_basic BOOLEAN,
  is_preferred BOOLEAN,
  attributes TEXT
);

CREATE INDEX IF NOT EXISTS idx_micro_usb_connector_stock
  ON micro_usb_connector (stock);
CREATE INDEX IF NOT EXISTS idx_micro_usb_connector_package_stock
  ON micro_usb_connector (package, stock);
CREATE INDEX IF NOT EXISTS idx_micro_usb_connector_connector_type_stock
  ON micro_usb_connector (connector_type, stock);
CREATE INDEX IF NOT EXISTS idx_micro_usb_connector_mounting_style_stock
  ON micro_usb_connector (mounting_style, stock);
CREATE INDEX IF NOT EXISTS idx_micro_usb_connector_number_of_contacts_stock
  ON micro_usb_connector (number_of_contacts, stock);
CREATE INDEX IF NOT EXISTS idx_micro_usb_connector_gender_stock
  ON micro_usb_connector (gender, stock);
CREATE INDEX IF NOT EXISTS idx_micro_usb_connector_is_basic_stock
  ON micro_usb_connector (is_basic, stock);
CREATE INDEX IF NOT EXISTS idx_micro_usb_connector_is_preferred_stock
  ON micro_usb_connector (is_preferred, stock);
