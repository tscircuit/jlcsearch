-- Migration 0010: Add is_extended_promotional column and indexes to component_catalog and search_index

-- Add is_extended_promotional to component_catalog
ALTER TABLE component_catalog ADD COLUMN is_extended_promotional INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_component_catalog_is_extended_promotional 
  ON component_catalog (is_extended_promotional);

-- Add is_extended_promotional to search_index
ALTER TABLE search_index ADD COLUMN is_extended_promotional INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_search_index_is_extended_promotional 
  ON search_index (is_extended_promotional);
CREATE INDEX IF NOT EXISTS idx_search_index_is_extended_promotional_stock 
  ON search_index (is_extended_promotional, stock DESC);
