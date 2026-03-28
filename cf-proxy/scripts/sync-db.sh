#!/bin/bash
set -e

# Sync SQLite database to Cloudflare D1
# By default this uses the local workspace database.
# Set SOURCE_DB_PATH to override, or set DATABASE_DOWNLOAD_TOKEN to pull from Fly.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="${SCRIPT_DIR}/../.db-sync-temp"
DEFAULT_LOCAL_DB="${SCRIPT_DIR}/../../db.sqlite3"

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
TABLES=$(sqlite3 db.sqlite3 "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'components_fts%' AND name NOT LIKE 'sqlite_%' ORDER BY name;")

# Create schema and data dump (excluding FTS tables)
echo "Creating SQL dump..."
sqlite3 db.sqlite3 << 'SCHEMA_EOF' > schema.sql
.output schema.sql
SELECT 'DROP TABLE IF EXISTS ' || name || ';' FROM sqlite_master
WHERE type='table'
AND name NOT LIKE 'components_fts%'
AND name NOT LIKE 'sqlite_%';
SCHEMA_EOF

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

has_column() {
  local table="$1"
  local column="$2"
  sqlite3 db.sqlite3 "SELECT 1 FROM pragma_table_info('$table') WHERE name = '$column' LIMIT 1;" | grep -q 1
}

echo "Materializing search index locally..."
sqlite3 db.sqlite3 <<'SEARCH_INDEX_SCHEMA'
DROP TABLE IF EXISTS search_index;
CREATE TABLE search_index (
  lcsc INTEGER,
  mfr TEXT,
  package TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  source_table TEXT
);
SEARCH_INDEX_SCHEMA

for table in $DERIVED_TABLES; do
  echo "Adding $table to local search index..."
  package_expr="NULL"
  price_expr="NULL"

  if has_column "$table" "package"; then
    package_expr="package"
  fi

  if has_column "$table" "price1"; then
    price_expr="price1"
  fi

  sqlite3 db.sqlite3 <<EOF
INSERT INTO search_index (lcsc, mfr, package, description, stock, price1, source_table)
SELECT
  lcsc,
  mfr,
  $package_expr,
  description,
  stock,
  $price_expr,
  '$table'
FROM $table
WHERE lcsc IS NOT NULL;
EOF
done

sqlite3 db.sqlite3 <<'SEARCH_INDEX_INDEXES'
CREATE INDEX IF NOT EXISTS idx_search_index_stock ON search_index(stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_lcsc ON search_index(lcsc);
CREATE INDEX IF NOT EXISTS idx_search_index_package ON search_index(package);
SEARCH_INDEX_INDEXES

echo "Exporting search index SQL..."
cat > search_index_schema.sql <<'SEARCH_INDEX_SCHEMA_EXPORT'
DROP TABLE IF EXISTS search_index;
CREATE TABLE search_index (
  lcsc INTEGER,
  mfr TEXT,
  package TEXT,
  description TEXT,
  stock INTEGER,
  price1 REAL,
  source_table TEXT
);
CREATE INDEX IF NOT EXISTS idx_search_index_stock ON search_index(stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_lcsc ON search_index(lcsc);
CREATE INDEX IF NOT EXISTS idx_search_index_package ON search_index(package);
SEARCH_INDEX_SCHEMA_EXPORT

sqlite3 db.sqlite3 ".mode insert search_index" ".output search_index_data.sql" "SELECT * FROM search_index;"

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

echo "Importing schema to D1..."
npx wrangler d1 execute jlcsearch --remote --file=schema.sql

echo "Importing data to D1..."
# Split data.sql into chunks if needed (D1 has query limits)
split -l 1000 data.sql data_chunk_

for chunk in data_chunk_*; do
  echo "Importing $chunk..."
  npx wrangler d1 execute jlcsearch --remote --file="$chunk" || echo "Warning: Some inserts in $chunk may have failed"
done

echo "Importing search index schema to D1..."
npx wrangler d1 execute jlcsearch --remote --file=search_index_schema.sql

echo "Importing search index data to D1..."
split -l 1000 search_index_data.sql search_index_chunk_

for chunk in search_index_chunk_*; do
  echo "Importing $chunk..."
  npx wrangler d1 execute jlcsearch --remote --file="$chunk" || echo "Warning: Some inserts in $chunk may have failed"
done

echo "Importing component catalog schema to D1..."
npx wrangler d1 execute jlcsearch --remote --file=component_catalog_schema.sql

echo "Importing component catalog data to D1..."
split -l 1000 component_catalog_data.sql component_catalog_chunk_

for chunk in component_catalog_chunk_*; do
  echo "Importing $chunk..."
  npx wrangler d1 execute jlcsearch --remote --file="$chunk" || echo "Warning: Some inserts in $chunk may have failed"
done

# Optional: Setup FTS5 if needed
if [ -f "${SCRIPT_DIR}/setup-fts5.sql" ]; then
  echo "Setting up FTS5..."
  npx wrangler d1 execute jlcsearch --remote --file="${SCRIPT_DIR}/setup-fts5.sql" || echo "Warning: FTS5 setup failed (may not be needed for D1)"
fi

echo "Cleaning up..."
cd "$SCRIPT_DIR"
rm -rf "$TEMP_DIR"

echo "Sync complete!"
