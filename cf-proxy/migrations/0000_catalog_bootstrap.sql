CREATE TABLE IF NOT EXISTS component_catalog (
  lcsc INTEGER NOT NULL UNIQUE,
  category TEXT,
  subcategory TEXT,
  mfr TEXT,
  package TEXT,
  basic INTEGER,
  preferred INTEGER,
  description TEXT,
  stock INTEGER,
  price TEXT,
  extra TEXT
);

CREATE INDEX IF NOT EXISTS idx_component_catalog_subcategory
  ON component_catalog(subcategory);
CREATE INDEX IF NOT EXISTS idx_component_catalog_package
  ON component_catalog(package);
CREATE INDEX IF NOT EXISTS idx_component_catalog_basic
  ON component_catalog(basic);
CREATE INDEX IF NOT EXISTS idx_component_catalog_preferred
  ON component_catalog(preferred);
CREATE INDEX IF NOT EXISTS idx_component_catalog_stock
  ON component_catalog(stock DESC);

CREATE TABLE IF NOT EXISTS search_index (
  lcsc INTEGER NOT NULL UNIQUE,
  mfr TEXT,
  package TEXT,
  description TEXT,
  stock INTEGER,
  price TEXT,
  price1 REAL,
  basic INTEGER,
  preferred INTEGER,
  category TEXT,
  subcategory TEXT,
  manufacturer_name TEXT,
  title TEXT,
  mpn TEXT,
  attributes TEXT,
  search_text TEXT
);

CREATE INDEX IF NOT EXISTS idx_search_index_stock
  ON search_index(stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_lcsc
  ON search_index(lcsc);
CREATE INDEX IF NOT EXISTS idx_search_index_package
  ON search_index(package);
CREATE INDEX IF NOT EXISTS idx_search_index_package_stock
  ON search_index(package, stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_subcategory_stock
  ON search_index(subcategory, stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_basic
  ON search_index(basic);
CREATE INDEX IF NOT EXISTS idx_search_index_basic_stock
  ON search_index(basic, stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_preferred
  ON search_index(preferred);
CREATE INDEX IF NOT EXISTS idx_search_index_preferred_stock
  ON search_index(preferred, stock DESC);
