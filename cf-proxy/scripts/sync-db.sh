#!/bin/bash
set -e

# Sync SQLite database from Fly.io to Cloudflare D1
# Requires: CLOUDFLARE_API_TOKEN, DATABASE_DOWNLOAD_TOKEN

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="${SCRIPT_DIR}/../.db-sync-temp"

echo "Creating temp directory..."
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo "Downloading database from Fly..."
curl -f -o db.sqlite3 "https://jlcsearch.fly.dev/database/${DATABASE_DOWNLOAD_TOKEN}"

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

echo "Importing schema to D1..."
npx wrangler d1 execute jlcsearch --remote --file=schema.sql

echo "Importing data to D1..."
# Split data.sql into chunks if needed (D1 has query limits)
split -l 1000 data.sql data_chunk_

for chunk in data_chunk_*; do
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
