-- Resume bounded scans without revisiting the beginning of every stock table.
CREATE TABLE IF NOT EXISTS _jlcsearch_stock_cleanup_progress (
  target TEXT PRIMARY KEY,
  after_lcsc INTEGER NOT NULL DEFAULT 0 CHECK (after_lcsc >= 0),
  completed_at INTEGER NOT NULL DEFAULT 0
);
