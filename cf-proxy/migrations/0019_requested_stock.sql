-- Retain demand and verified metadata across nightly catalog replacements.
CREATE TABLE IF NOT EXISTS _jlcsearch_requested_parts (
  lcsc INTEGER PRIMARY KEY,
  requested_at INTEGER NOT NULL,
  attempted_at INTEGER NOT NULL DEFAULT 0,
  verified_at INTEGER,
  component_json TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_requested_parts_refresh
  ON _jlcsearch_requested_parts(attempted_at, requested_at);
