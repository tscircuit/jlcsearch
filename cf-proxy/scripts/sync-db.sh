#!/bin/bash
set -e

# Sync SQLite database to Cloudflare D1
# By default this uses the local workspace database.
# Set SOURCE_DB_PATH to override, or set DATABASE_DOWNLOAD_TOKEN to pull from Fly.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="${SCRIPT_DIR}/../.db-sync-temp"
DEFAULT_LOCAL_DB="${SCRIPT_DIR}/../../db.sqlite3"

if command -v bunx >/dev/null 2>&1; then
  WRANGLER_CMD=(bunx wrangler)
else
  WRANGLER_CMD=(npx wrangler)
fi

run_wrangler() {
  "${WRANGLER_CMD[@]}" "$@"
}

echo "Creating temp directory..."
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

if [ -n "${SOURCE_DB_PATH}" ]; then
  echo "Copying database from SOURCE_DB_PATH=${SOURCE_DB_PATH}..."
  cp "${SOURCE_DB_PATH}" db.sqlite3
elif [ -f "${DEFAULT_LOCAL_DB}" ]; then
  echo "Copying local database from ${DEFAULT_LOCAL_DB}..."
  cp "${DEFAULT_LOCAL_DB}" db.sqlite3
elif [ -n "${DATABASE_DOWNLOAD_TOKEN}" ]; then
  echo "Downloading database from Fly..."
  curl -f -o db.sqlite3 "https://jlcsearch.fly.dev/database/${DATABASE_DOWNLOAD_TOKEN}"
else
  echo "No database source available."
  echo "Set SOURCE_DB_PATH, ensure ${DEFAULT_LOCAL_DB} exists, or set DATABASE_DOWNLOAD_TOKEN."
  exit 1
fi

echo "Database size: $(du -h db.sqlite3 | cut -f1)"

# List all tables (excluding FTS virtual tables and internal tables)
echo "Extracting derived tables..."
TABLES=$(sqlite3 db.sqlite3 "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'components_fts%' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('components', 'component_catalog', 'search_index') ORDER BY name;")

# Create schema and data dump (excluding FTS tables)
echo "Creating SQL dump..."
sqlite3 db.sqlite3 << 'SCHEMA_EOF' > schema.sql
SELECT 'DROP TABLE IF EXISTS "' || name || '";' FROM sqlite_master
WHERE type='table'
AND name NOT LIKE 'components_fts%'
AND name NOT LIKE 'sqlite_%'
AND name NOT IN ('components', 'component_catalog', 'search_index');
SCHEMA_EOF

cat > cleanup_obsolete_objects.sql <<'CLEANUP_EOF'
DROP TRIGGER IF EXISTS components_ai;
DROP TRIGGER IF EXISTS components_au;
DROP TRIGGER IF EXISTS components_ad;
DROP INDEX IF EXISTS components_category;
DROP INDEX IF EXISTS components_manufacturer;
DROP TABLE IF EXISTS components_fts;
DROP TABLE IF EXISTS components;
DROP TABLE IF EXISTS search_index_old;
CLEANUP_EOF

# Export schema for each table
for table in $TABLES; do
  echo "Exporting schema for $table..."
  sqlite3 db.sqlite3 ".schema $table" >> schema.sql
done

# Export data for derived tables only (not the main components table which is huge)
# The derived tables are the ones we query via D1
DERIVED_TABLES="accelerometer adc analog_multiplexer battery_holder bjt_transistor boost_converter buck_boost_converter capacitor dac diode fpc_connector fpga fuse gas_sensor gyroscope header io_expander jst_connector lcd_display ldo led led_dot_matrix_display led_driver led_segment_display led_with_ic microcontroller mosfet oled_display pcie_m2_connector potentiometer relay resistor resistor_array switch usb_c_connector voltage_regulator wifi_module wire_to_board_connector"

echo "Creating data dump for derived tables..."
rm -f data.sql
for table in $DERIVED_TABLES; do
  echo "Exporting data for $table..."
  sqlite3 db.sqlite3 ".mode insert $table" ".output stdout" "SELECT * FROM $table;" >> data.sql 2>/dev/null || echo "-- Table $table not found, skipping" >> data.sql
done

echo "Materializing component catalog locally..."
sqlite3 db.sqlite3 <<'COMPONENT_CATALOG_SCHEMA'
DROP TABLE IF EXISTS component_catalog;
CREATE TABLE component_catalog AS
SELECT
  lcsc,
  category,
  subcategory,
  mfr,
  package,
  basic,
  preferred,
  description,
  stock,
  price,
  extra
FROM v_components;

CREATE INDEX IF NOT EXISTS idx_component_catalog_subcategory ON component_catalog(subcategory);
CREATE INDEX IF NOT EXISTS idx_component_catalog_package ON component_catalog(package);
CREATE INDEX IF NOT EXISTS idx_component_catalog_basic ON component_catalog(basic);
CREATE INDEX IF NOT EXISTS idx_component_catalog_preferred ON component_catalog(preferred);
CREATE INDEX IF NOT EXISTS idx_component_catalog_stock ON component_catalog(stock DESC);
COMPONENT_CATALOG_SCHEMA

echo "Exporting component catalog SQL..."
cat > component_catalog_schema.sql <<'COMPONENT_CATALOG_SCHEMA_EXPORT'
DROP TABLE IF EXISTS component_catalog;
CREATE TABLE component_catalog (
  lcsc INTEGER,
  category TEXT,
  subcategory TEXT,
  mfr TEXT,
  package TEXT,
  basic INTEGER,
  preferred INTEGER,
  description TEXT,
  stock INTEGER,
  price TEXT,
  extra TEXT
);
CREATE INDEX IF NOT EXISTS idx_component_catalog_subcategory ON component_catalog(subcategory);
CREATE INDEX IF NOT EXISTS idx_component_catalog_package ON component_catalog(package);
CREATE INDEX IF NOT EXISTS idx_component_catalog_basic ON component_catalog(basic);
CREATE INDEX IF NOT EXISTS idx_component_catalog_preferred ON component_catalog(preferred);
CREATE INDEX IF NOT EXISTS idx_component_catalog_stock ON component_catalog(stock DESC);
COMPONENT_CATALOG_SCHEMA_EXPORT

sqlite3 db.sqlite3 ".mode insert component_catalog" ".output component_catalog_data.sql" "SELECT * FROM component_catalog;"

echo "Materializing search index locally..."
sqlite3 db.sqlite3 <<'SEARCH_INDEX_SCHEMA'
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
SEARCH_INDEX_SCHEMA

echo "Exporting search index SQL..."
cat > search_index_schema.sql <<'SEARCH_INDEX_SCHEMA_EXPORT'
DROP TABLE IF EXISTS search_index;
CREATE TABLE search_index (
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
);
CREATE INDEX IF NOT EXISTS idx_search_index_stock ON search_index(stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_lcsc ON search_index(lcsc);
CREATE INDEX IF NOT EXISTS idx_search_index_package ON search_index(package);
CREATE INDEX IF NOT EXISTS idx_search_index_basic ON search_index(basic);
CREATE INDEX IF NOT EXISTS idx_search_index_preferred ON search_index(preferred);
SEARCH_INDEX_SCHEMA_EXPORT

sqlite3 db.sqlite3 ".mode insert search_index" ".output search_index_data.sql" "SELECT * FROM search_index;"

echo "Importing schema to D1..."
run_wrangler d1 execute jlcsearch --remote --file=cleanup_obsolete_objects.sql
run_wrangler d1 execute jlcsearch --remote --file=schema.sql

echo "Importing data to D1..."
# Split data.sql into chunks if needed (D1 has query limits)
split -l 1000 data.sql data_chunk_

for chunk in data_chunk_*; do
  echo "Importing $chunk..."
  run_wrangler d1 execute jlcsearch --remote --file="$chunk" || echo "Warning: Some inserts in $chunk may have failed"
done

echo "Importing search index schema to D1..."
run_wrangler d1 execute jlcsearch --remote --file=search_index_schema.sql

echo "Importing search index data to D1..."
split -l 1000 search_index_data.sql search_index_chunk_

for chunk in search_index_chunk_*; do
  echo "Importing $chunk..."
  run_wrangler d1 execute jlcsearch --remote --file="$chunk" || echo "Warning: Some inserts in $chunk may have failed"
done

echo "Importing component catalog schema to D1..."
run_wrangler d1 execute jlcsearch --remote --file=component_catalog_schema.sql

echo "Importing component catalog data to D1..."
split -l 1000 component_catalog_data.sql component_catalog_chunk_

for chunk in component_catalog_chunk_*; do
  echo "Importing $chunk..."
  run_wrangler d1 execute jlcsearch --remote --file="$chunk" || echo "Warning: Some inserts in $chunk may have failed"
done

# Optional: Setup FTS5 if needed
if [ -f "${SCRIPT_DIR}/setup-fts5.sql" ]; then
  echo "Setting up FTS5..."
  run_wrangler d1 execute jlcsearch --remote --file="${SCRIPT_DIR}/setup-fts5.sql" || echo "Warning: FTS5 setup failed (may not be needed for D1)"
fi

echo "Cleaning up..."
cd "$SCRIPT_DIR"
rm -rf "$TEMP_DIR"

echo "Sync complete!"
