DROP TABLE IF EXISTS search_index;

CREATE TABLE search_index AS
SELECT
  lcsc,
  mfr,
  package,
  description,
  stock,
  price,
  CASE
    WHEN json_valid(price) THEN CAST(json_extract(price, '$[0].price') AS REAL)
    ELSE NULL
  END AS price1,
  basic,
  preferred,
  category,
  subcategory,
  CASE
    WHEN json_valid(extra) THEN json_extract(extra, '$.manufacturer.name')
    ELSE NULL
  END AS manufacturer_name,
  CASE
    WHEN json_valid(extra) THEN json_extract(extra, '$.title')
    ELSE NULL
  END AS title,
  CASE
    WHEN json_valid(extra) THEN json_extract(extra, '$.mpn')
    ELSE NULL
  END AS mpn,
  CASE
    WHEN json_valid(extra) THEN json_extract(extra, '$.attributes')
    ELSE NULL
  END AS attributes,
  lower(trim(
    coalesce(mfr, '') || ' ' ||
    coalesce(package, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(category, '') || ' ' ||
    coalesce(subcategory, '') || ' ' ||
    coalesce(CASE WHEN json_valid(extra) THEN json_extract(extra, '$.manufacturer.name') END, '') || ' ' ||
    coalesce(CASE WHEN json_valid(extra) THEN json_extract(extra, '$.title') END, '') || ' ' ||
    coalesce(CASE WHEN json_valid(extra) THEN json_extract(extra, '$.mpn') END, '') || ' ' ||
    coalesce(CASE WHEN json_valid(extra) THEN json_extract(extra, '$.attributes') END, '')
  )) AS search_text
FROM component_catalog
WHERE lcsc IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_search_index_stock ON search_index(stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_lcsc ON search_index(lcsc);
CREATE INDEX IF NOT EXISTS idx_search_index_package ON search_index(package);
CREATE INDEX IF NOT EXISTS idx_search_index_basic ON search_index(basic);
CREATE INDEX IF NOT EXISTS idx_search_index_preferred ON search_index(preferred);
