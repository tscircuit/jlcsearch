CREATE TABLE IF NOT EXISTS photo_diode (
  lcsc INTEGER PRIMARY KEY,
  mfr TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  in_stock BOOLEAN,
  package TEXT,
  peak_wavelength_nm REAL,
  spectral_range_min_nm REAL,
  spectral_range_max_nm REAL,
  reverse_voltage REAL,
  dark_current_a REAL,
  reception_angle_deg REAL,
  operating_temp_min REAL,
  operating_temp_max REAL,
  is_basic BOOLEAN,
  is_preferred BOOLEAN,
  attributes TEXT
);

CREATE INDEX IF NOT EXISTS idx_photo_diode_stock
  ON photo_diode (stock);
CREATE INDEX IF NOT EXISTS idx_photo_diode_package_stock
  ON photo_diode (package, stock);
CREATE INDEX IF NOT EXISTS idx_photo_diode_peak_wavelength_stock
  ON photo_diode (peak_wavelength_nm, stock);
CREATE INDEX IF NOT EXISTS idx_photo_diode_reverse_voltage_stock
  ON photo_diode (reverse_voltage, stock);
CREATE INDEX IF NOT EXISTS idx_photo_diode_dark_current_stock
  ON photo_diode (dark_current_a, stock);
CREATE INDEX IF NOT EXISTS idx_photo_diode_is_basic_stock
  ON photo_diode (is_basic, stock);
CREATE INDEX IF NOT EXISTS idx_photo_diode_is_preferred_stock
  ON photo_diode (is_preferred, stock);
