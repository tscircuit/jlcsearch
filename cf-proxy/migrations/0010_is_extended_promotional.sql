-- Full catalog sync intentionally removes the legacy components table.
-- Backfill immediately: the normal scheduled sync only refreshes stock/status.
-- Legacy basic=0 is the only retained non-base classification. Older builds
-- also mapped null library_type to 0; a current source snapshot corrects that
-- indistinguishable historical case using strict source null handling.
ALTER TABLE component_catalog ADD COLUMN is_extended_promotional INTEGER NOT NULL DEFAULT 0;
ALTER TABLE search_index ADD COLUMN is_extended_promotional INTEGER NOT NULL DEFAULT 0;

UPDATE component_catalog
SET is_extended_promotional = CASE WHEN basic = 0 AND preferred = 1 THEN 1 ELSE 0 END;
UPDATE search_index
SET is_extended_promotional = CASE WHEN basic = 0 AND preferred = 1 THEN 1 ELSE 0 END;

CREATE INDEX IF NOT EXISTS idx_component_catalog_is_extended_promotional_stock
  ON component_catalog(is_extended_promotional, stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_is_extended_promotional_stock
  ON search_index(is_extended_promotional, stock DESC);
