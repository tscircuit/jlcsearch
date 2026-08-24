ALTER TABLE component_catalog ADD COLUMN is_extended_promotional INTEGER;

UPDATE component_catalog
SET is_extended_promotional = CASE
  WHEN basic = 0 AND preferred = 1 THEN 1
  ELSE 0
END
WHERE is_extended_promotional IS NULL;

CREATE INDEX IF NOT EXISTS idx_component_catalog_extended_promotional_stock
  ON component_catalog(is_extended_promotional, stock DESC);

ALTER TABLE search_index ADD COLUMN is_extended_promotional INTEGER;

UPDATE search_index
SET is_extended_promotional = (
  SELECT source.is_extended_promotional
  FROM component_catalog AS source
  WHERE source.lcsc = search_index.lcsc
)
WHERE EXISTS (
  SELECT 1
  FROM component_catalog AS source
  WHERE source.lcsc = search_index.lcsc
)
  AND is_extended_promotional IS NULL;

UPDATE search_index
SET is_extended_promotional = CASE
  WHEN basic = 0 AND preferred = 1 THEN 1
  ELSE 0
END
WHERE is_extended_promotional IS NULL;

CREATE INDEX IF NOT EXISTS idx_search_index_extended_promotional_stock
  ON search_index(is_extended_promotional, stock DESC);
