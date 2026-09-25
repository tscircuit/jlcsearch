ALTER TABLE component_catalog ADD COLUMN is_extended_promotional INTEGER;

ALTER TABLE search_index ADD COLUMN is_extended_promotional INTEGER;

CREATE INDEX IF NOT EXISTS idx_component_catalog_is_extended_promotional
  ON component_catalog(is_extended_promotional);

CREATE INDEX IF NOT EXISTS idx_search_index_is_extended_promotional
  ON search_index(is_extended_promotional);
