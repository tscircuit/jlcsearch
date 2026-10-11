-- These tables survive catalog replacements. observed_stock deliberately does
-- not use the stock column name discovered by the stock-sync generator.
CREATE TABLE IF NOT EXISTS _jlcsearch_live_stock (
  lcsc INTEGER PRIMARY KEY,
  observed_stock INTEGER,
  checked_at INTEGER NOT NULL,
  category TEXT,
  subcategory TEXT,
  seen_cycle TEXT,
  expired INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_live_stock_expiry
  ON _jlcsearch_live_stock(expired, checked_at, lcsc);
CREATE INDEX IF NOT EXISTS idx_live_stock_cycle
  ON _jlcsearch_live_stock(category, subcategory, seen_cycle);

CREATE TABLE IF NOT EXISTS _jlcsearch_stock_categories (
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  next_page INTEGER NOT NULL DEFAULT 1,
  cycle TEXT NOT NULL DEFAULT '',
  expected_total INTEGER,
  consistent INTEGER NOT NULL DEFAULT 1,
  web_category TEXT,
  web_subcategory TEXT,
  attempted_at INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(category, subcategory)
);

CREATE TABLE IF NOT EXISTS _jlcsearch_stock_policy (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  grace_until INTEGER NOT NULL,
  max_age_seconds INTEGER NOT NULL
);
-- Allow an initial sweep before unverified snapshot stock becomes unknown.
INSERT OR IGNORE INTO _jlcsearch_stock_policy VALUES
  (1, unixepoch() + 7 * 86400, 72 * 3600);
