ALTER TABLE component_catalog ADD COLUMN is_extended_promotional INTEGER;

UPDATE component_catalog
SET is_extended_promotional = CASE
  WHEN preferred = 1 AND (basic IS NULL OR basic = 0) THEN 1
  ELSE 0
END;

ALTER TABLE search_index ADD COLUMN is_extended_promotional INTEGER;

UPDATE search_index
SET is_extended_promotional = CASE
  WHEN preferred = 1 AND (basic IS NULL OR basic = 0) THEN 1
  ELSE 0
END;

CREATE INDEX IF NOT EXISTS idx_search_index_extended_promotional ON search_index(is_extended_promotional);
CREATE INDEX IF NOT EXISTS idx_search_index_extended_promotional_stock ON search_index(is_extended_promotional, stock DESC);
