-- JLCPCB marks parts its Economic PCBA line cannot place as "Standard only".
-- Recorded from the same website pages as live stock: 1 Standard only,
-- 0 either service, NULL not observed yet.
ALTER TABLE _jlcsearch_live_stock ADD COLUMN is_standard_only INTEGER;
CREATE INDEX IF NOT EXISTS idx_live_stock_standard_only
  ON _jlcsearch_live_stock(is_standard_only, lcsc);
