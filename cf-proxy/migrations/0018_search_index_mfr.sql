-- Bootstrap the same catalog schema used by sync-db.sh on a fresh database.
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

CREATE INDEX IF NOT EXISTS idx_search_index_mfr_stock
  ON search_index(mfr COLLATE NOCASE, stock DESC);
