-- Add the is_extended_promotional flag derived from the source catalog's
-- preferred + library_type fields (preferred non-base parts currently acting
-- as basic). Backfilled to 0; the next sync repopulates real values.
ALTER TABLE component_catalog ADD COLUMN is_extended_promotional INTEGER;
ALTER TABLE search_index ADD COLUMN is_extended_promotional INTEGER;
ALTER TABLE components ADD COLUMN is_extended_promotional INTEGER;

CREATE INDEX IF NOT EXISTS idx_component_catalog_is_extended_promotional
  ON component_catalog (is_extended_promotional, stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_is_extended_promotional
  ON search_index (is_extended_promotional, stock DESC);
