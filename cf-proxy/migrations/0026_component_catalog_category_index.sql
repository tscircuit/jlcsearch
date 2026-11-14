-- /categories/list and the stock crawler read distinct category pairs. This
-- index answers them without scanning every catalog row. Building it reads
-- the whole catalog once.
CREATE INDEX IF NOT EXISTS idx_component_catalog_category_subcategory
  ON component_catalog (category, subcategory);
