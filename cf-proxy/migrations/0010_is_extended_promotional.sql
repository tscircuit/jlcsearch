ALTER TABLE component_catalog ADD COLUMN is_extended_promotional INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_component_catalog_is_extended_promotional ON component_catalog(is_extended_promotional);
