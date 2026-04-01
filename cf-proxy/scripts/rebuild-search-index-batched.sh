#!/bin/bash
set -euo pipefail

DB_NAME="${DB_NAME:-jlcsearch}"
BATCH_SIZE="${BATCH_SIZE:-25000}"
TMP_SQL="$(mktemp /tmp/search-index-batch.XXXXXX.sql)"
trap 'rm -f "$TMP_SQL"' EXIT

if command -v bunx >/dev/null 2>&1; then
  WRANGLER_CMD=(bunx wrangler)
else
  WRANGLER_CMD=(npx wrangler)
fi

run_wrangler() {
  "${WRANGLER_CMD[@]}" "$@"
}

echo "Fetching component_catalog bounds..."
MAX_ROWID="$(
  run_wrangler d1 execute "$DB_NAME" --remote --command \
    "SELECT MAX(rowid) AS max_rowid FROM component_catalog;" \
    | rg -o '"max_rowid":\s*[0-9]+' \
    | rg -o '[0-9]+' \
    | tail -n1
)"

if [[ -z "${MAX_ROWID}" ]]; then
  echo "Failed to determine component_catalog max_rowid"
  exit 1
fi

echo "Recreating search_index_next schema..."
run_wrangler d1 execute "$DB_NAME" --remote --command \
  "DROP TABLE IF EXISTS search_index_next;
   CREATE TABLE search_index_next (
     lcsc INTEGER,
     mfr TEXT,
     package TEXT,
     description TEXT,
     stock INTEGER,
     price TEXT,
     price1 REAL,
     basic INTEGER,
     preferred INTEGER,
     category TEXT,
     subcategory TEXT,
     manufacturer_name TEXT,
     title TEXT,
     mpn TEXT,
     attributes TEXT,
     search_text TEXT
   );"

for ((start=1; start<=MAX_ROWID; start+=BATCH_SIZE)); do
  end=$((start + BATCH_SIZE - 1))
  if [[ "$end" -gt "$MAX_ROWID" ]]; then
    end="$MAX_ROWID"
  fi

  echo "Loading rows ${start}-${end}..."
  cat <<'EOF' | sed "s/__START__/${start}/g; s/__END__/${end}/g" > "$TMP_SQL"
INSERT INTO search_index_next (
  lcsc,
  mfr,
  package,
  description,
  stock,
  price,
  price1,
  basic,
  preferred,
  category,
  subcategory,
  manufacturer_name,
  title,
  mpn,
  attributes,
  search_text
)
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
WHERE rowid BETWEEN __START__ AND __END__;
EOF

  run_wrangler d1 execute "$DB_NAME" --remote --file="$TMP_SQL"
done

echo "Creating indexes on search_index_next..."
run_wrangler d1 execute "$DB_NAME" --remote --command \
  "CREATE INDEX IF NOT EXISTS idx_search_index_next_stock ON search_index_next(stock DESC);
   CREATE INDEX IF NOT EXISTS idx_search_index_next_lcsc ON search_index_next(lcsc);
   CREATE INDEX IF NOT EXISTS idx_search_index_next_package ON search_index_next(package);
   CREATE INDEX IF NOT EXISTS idx_search_index_next_basic ON search_index_next(basic);
   CREATE INDEX IF NOT EXISTS idx_search_index_next_preferred ON search_index_next(preferred);"

echo "Validating row count..."
run_wrangler d1 execute "$DB_NAME" --remote --command \
  "SELECT
     (SELECT COUNT(*) FROM component_catalog) AS component_catalog_count,
     (SELECT COUNT(*) FROM search_index_next) AS search_index_next_count;"

echo "Swapping search index tables..."
run_wrangler d1 execute "$DB_NAME" --remote --command \
  "DROP TRIGGER IF EXISTS components_ai;
   DROP TRIGGER IF EXISTS components_au;
   DROP TRIGGER IF EXISTS components_ad;
   DROP INDEX IF EXISTS components_category;
   DROP INDEX IF EXISTS components_manufacturer;
   DROP TABLE IF EXISTS components_fts;
   DROP TABLE IF EXISTS components;
   DROP TABLE IF EXISTS search_index_old;
   ALTER TABLE search_index RENAME TO search_index_old;
   DROP INDEX IF EXISTS idx_search_index_stock;
   DROP INDEX IF EXISTS idx_search_index_lcsc;
   DROP INDEX IF EXISTS idx_search_index_package;
   DROP INDEX IF EXISTS idx_search_index_basic;
   DROP INDEX IF EXISTS idx_search_index_preferred;
   ALTER TABLE search_index_next RENAME TO search_index;
   CREATE INDEX IF NOT EXISTS idx_search_index_stock ON search_index(stock DESC);
   CREATE INDEX IF NOT EXISTS idx_search_index_lcsc ON search_index(lcsc);
   CREATE INDEX IF NOT EXISTS idx_search_index_package ON search_index(package);
   CREATE INDEX IF NOT EXISTS idx_search_index_basic ON search_index(basic);
   CREATE INDEX IF NOT EXISTS idx_search_index_preferred ON search_index(preferred);"

echo "Done. Old table kept as search_index_old for rollback."
