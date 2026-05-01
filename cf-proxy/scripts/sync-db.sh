#!/bin/bash
set -euo pipefail

# Sync a prepared SQLite database into Cloudflare D1.
# The script works from a copied temp DB so it can safely rebuild derived tables
# before exporting them.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TEMP_DIR="${SCRIPT_DIR}/../.db-sync-temp"
DEFAULT_LOCAL_DB="${REPO_ROOT}/db.sqlite3"
DB_NAME="${DB_NAME:-jlcsearch}"
BATCH_ROWS="${BATCH_ROWS:-250}"
COMPONENT_CATALOG_BATCH_ROWS="${COMPONENT_CATALOG_BATCH_ROWS:-${BATCH_ROWS}}"
SEARCH_INDEX_BATCH_ROWS="${SEARCH_INDEX_BATCH_ROWS:-${BATCH_ROWS}}"
FTS_BATCH_ROWS="${FTS_BATCH_ROWS:-25000}"
SYNC_DERIVED_TABLES="${SYNC_DERIVED_TABLES:-1}"
SYNC_COMPONENT_CATALOG="${SYNC_COMPONENT_CATALOG:-0}"
SYNC_SEARCH_INDEX="${SYNC_SEARCH_INDEX:-0}"
DERIVED_TABLES_LIST="${DERIVED_TABLES_LIST:-}"

DERIVED_TABLES=(
  accelerometer
  adc
  analog_multiplexer
  battery_holder
  bjt_transistor
  boost_converter
  buck_boost_converter
  capacitor
  dac
  diode
  fpc_connector
  fpga
  fuse
  gas_sensor
  gyroscope
  header
  io_expander
  jst_connector
  lcd_display
  ldo
  led
  led_dot_matrix_display
  led_driver
  led_segment_display
  led_with_ic
  microcontroller
  mosfet
  oled_display
  pcie_m2_connector
  potentiometer
  relay
  resistor
  resistor_array
  switch
  usb_c_connector
  voltage_regulator
  wifi_module
  wire_to_board_connector
)
ACTIVE_DERIVED_TABLES=("${DERIVED_TABLES[@]}")

if command -v bunx >/dev/null 2>&1; then
  WRANGLER_CMD=(bunx wrangler)
else
  WRANGLER_CMD=(npx wrangler)
fi

run_wrangler() {
  "${WRANGLER_CMD[@]}" "$@"
}

rebuild_remote_search_fts_index() {
  local row_count start end

  row_count="$(sqlite3 db.sqlite3 "SELECT MAX(rowid) FROM search_index;")"
  if [[ -z "${row_count}" || "${row_count}" == "0" ]]; then
    echo "Skipping FTS5 setup: search_index is empty."
    return
  fi

  echo "Initializing search_index_fts..."
  run_wrangler d1 execute "${DB_NAME}" --remote --file="${SCRIPT_DIR}/setup-fts5.sql"

  for ((start=1; start<=row_count; start+=FTS_BATCH_ROWS)); do
    end=$((start + FTS_BATCH_ROWS - 1))
    if (( end > row_count )); then
      end=${row_count}
    fi

    echo "  importing FTS rowids ${start}-${end}"
    run_wrangler d1 execute "${DB_NAME}" --remote --command "
      INSERT INTO search_index_fts(rowid, search_text)
      SELECT rowid, search_text
      FROM search_index
      WHERE rowid BETWEEN ${start} AND ${end}
        AND search_text IS NOT NULL
        AND search_text != '';
    "
  done

  run_wrangler d1 execute "${DB_NAME}" --remote --command "
    INSERT INTO search_index_fts(search_index_fts) VALUES('optimize');
    UPDATE search_index_fts_meta SET value = '1' WHERE key = 'ready';
  "
}

cleanup() {
  cd "$SCRIPT_DIR"
  if [[ "${KEEP_SYNC_TEMP:-0}" != "1" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}

trap cleanup EXIT

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command '$command_name' is not installed."
    exit 1
  fi
}

table_exists() {
  local table="$1"
  sqlite3 db.sqlite3 \
    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='${table}');"
}

require_table() {
  local table="$1"
  if [[ "$(table_exists "$table")" != "1" ]]; then
    echo "Expected table '$table' to exist in the source database."
    exit 1
  fi
}

select_derived_tables() {
  if [[ -z "${DERIVED_TABLES_LIST}" ]]; then
    ACTIVE_DERIVED_TABLES=("${DERIVED_TABLES[@]}")
    return
  fi

  local requested raw_table normalized found
  local filtered=()
  IFS=',' read -r -a requested <<< "${DERIVED_TABLES_LIST}"

  for raw_table in "${requested[@]}"; do
    normalized="$(echo "${raw_table}" | xargs)"
    if [[ -z "${normalized}" ]]; then
      continue
    fi

    found=0
    for table in "${DERIVED_TABLES[@]}"; do
      if [[ "${table}" == "${normalized}" ]]; then
        filtered+=("${table}")
        found=1
        break
      fi
    done

    if [[ "${found}" != "1" ]]; then
      echo "Unknown derived table '${normalized}' in DERIVED_TABLES_LIST."
      exit 1
    fi
  done

  if [[ "${#filtered[@]}" -eq 0 ]]; then
    echo "DERIVED_TABLES_LIST did not resolve to any derived tables."
    exit 1
  fi

  ACTIVE_DERIVED_TABLES=("${filtered[@]}")
}

copy_source_db() {
  rm -rf "$TEMP_DIR"
  mkdir -p "$TEMP_DIR"
  cd "$TEMP_DIR"

  if [[ -n "${SOURCE_DB_PATH:-}" ]]; then
    echo "Copying database from SOURCE_DB_PATH=${SOURCE_DB_PATH}..."
    cp "${SOURCE_DB_PATH}" db.sqlite3
  elif [[ -f "${DEFAULT_LOCAL_DB}" ]]; then
    echo "Copying local database from ${DEFAULT_LOCAL_DB}..."
    cp "${DEFAULT_LOCAL_DB}" db.sqlite3
  elif [[ -n "${DATABASE_DOWNLOAD_TOKEN:-}" ]]; then
    echo "DATABASE_DOWNLOAD_TOKEN/Fly fallback is no longer supported."
    echo "Use SOURCE_DB_PATH or ensure ${DEFAULT_LOCAL_DB} exists."
    exit 1
  else
    echo "No database source available."
    echo "Set SOURCE_DB_PATH or ensure ${DEFAULT_LOCAL_DB} exists."
    exit 1
  fi

  echo "Database size: $(du -h db.sqlite3 | cut -f1)"
}

rebuild_derived_tables() {
  echo "Rebuilding derived tables in temp database..."
  if [[ "${#ACTIVE_DERIVED_TABLES[@]}" -eq "${#DERIVED_TABLES[@]}" ]]; then
    (
      cd "$REPO_ROOT"
      JLCSEARCH_DB_PATH="${TEMP_DIR}/db.sqlite3" bun run scripts/setup-derived-tables.ts --reset
    )
    return
  fi

  local table
  for table in "${ACTIVE_DERIVED_TABLES[@]}"; do
    (
      cd "$REPO_ROOT"
      JLCSEARCH_DB_PATH="${TEMP_DIR}/db.sqlite3" bun run scripts/setup-derived-tables.ts --reset "${table}"
    )
  done
}

create_derived_schema_dump() {
  echo "Creating derived-table schema dump..."
  : > schema.sql

  for table in "${ACTIVE_DERIVED_TABLES[@]}"; do
    require_table "$table"
    printf 'DROP TABLE IF EXISTS "%s";\n' "$table" >> schema.sql
    sqlite3 db.sqlite3 ".schema ${table}" >> schema.sql
    printf '\n' >> schema.sql
  done
}

import_table_in_batches() {
  local table="$1"
  local batch_size="$2"
  local row_count offset batch_end chunk_file

  require_table "$table"
  row_count="$(sqlite3 db.sqlite3 "SELECT COUNT(*) FROM \"${table}\";")"

  if [[ "${row_count}" == "0" ]]; then
    echo "Skipping ${table}: source table is empty."
    return
  fi

  echo "Importing ${table} (${row_count} rows, batch size ${batch_size})..."
  chunk_file="${TEMP_DIR}/${table}.chunk.sql"

  for ((offset=0; offset<row_count; offset+=batch_size)); do
    batch_end=$((offset + batch_size))
    if (( batch_end > row_count )); then
      batch_end=${row_count}
    fi

    sqlite3 db.sqlite3 <<EOF > "${chunk_file}"
.mode insert ${table}
.output stdout
SELECT * FROM "${table}" ORDER BY rowid LIMIT ${batch_size} OFFSET ${offset};
EOF

    if [[ ! -s "${chunk_file}" ]]; then
      continue
    fi

    echo "  importing rows $((offset + 1))-${batch_end}"
    run_wrangler d1 execute "${DB_NAME}" --remote --file="${chunk_file}"
  done

  rm -f "${chunk_file}"
}

write_cleanup_sql() {
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
}

materialize_component_catalog() {
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
}

materialize_search_index() {
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
CREATE INDEX IF NOT EXISTS idx_search_index_package_stock ON search_index(package, stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_subcategory_stock ON search_index(subcategory, stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_basic ON search_index(basic);
CREATE INDEX IF NOT EXISTS idx_search_index_basic_stock ON search_index(basic, stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_preferred ON search_index(preferred);
CREATE INDEX IF NOT EXISTS idx_search_index_preferred_stock ON search_index(preferred, stock DESC);
SEARCH_INDEX_SCHEMA

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
CREATE INDEX IF NOT EXISTS idx_search_index_package_stock ON search_index(package, stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_subcategory_stock ON search_index(subcategory, stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_basic ON search_index(basic);
CREATE INDEX IF NOT EXISTS idx_search_index_basic_stock ON search_index(basic, stock DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_preferred ON search_index(preferred);
CREATE INDEX IF NOT EXISTS idx_search_index_preferred_stock ON search_index(preferred, stock DESC);
SEARCH_INDEX_SCHEMA_EXPORT
}

main() {
  require_command bun
  require_command sqlite3

  if [[ "${SYNC_DERIVED_TABLES}" != "1" && "${SYNC_COMPONENT_CATALOG}" != "1" && "${SYNC_SEARCH_INDEX}" != "1" ]]; then
    echo "Nothing to sync. Enable at least one of SYNC_DERIVED_TABLES=1, SYNC_COMPONENT_CATALOG=1, or SYNC_SEARCH_INDEX=1."
    exit 1
  fi

  copy_source_db
  select_derived_tables

  if [[ "${SYNC_DERIVED_TABLES}" == "1" ]]; then
    rebuild_derived_tables
    create_derived_schema_dump

    echo "Importing derived-table schema to D1..."
    run_wrangler d1 execute "${DB_NAME}" --remote --file=schema.sql

    for table in "${ACTIVE_DERIVED_TABLES[@]}"; do
      import_table_in_batches "${table}" "${BATCH_ROWS}"
    done
  fi

  if [[ "${SYNC_COMPONENT_CATALOG}" == "1" || "${SYNC_SEARCH_INDEX}" == "1" ]]; then
    write_cleanup_sql
    materialize_component_catalog

    echo "Importing cleanup SQL to D1..."
    run_wrangler d1 execute "${DB_NAME}" --remote --file=cleanup_obsolete_objects.sql
  fi

  if [[ "${SYNC_COMPONENT_CATALOG}" == "1" ]]; then
    echo "Importing component catalog schema to D1..."
    run_wrangler d1 execute "${DB_NAME}" --remote --file=component_catalog_schema.sql
    import_table_in_batches component_catalog "${COMPONENT_CATALOG_BATCH_ROWS}"
  fi

  if [[ "${SYNC_SEARCH_INDEX}" == "1" ]]; then
    materialize_search_index
    echo "Importing search index schema to D1..."
    run_wrangler d1 execute "${DB_NAME}" --remote --file=search_index_schema.sql
    import_table_in_batches search_index "${SEARCH_INDEX_BATCH_ROWS}"
  fi

  if [[ -f "${SCRIPT_DIR}/setup-fts5.sql" ]]; then
    echo "Setting up FTS5..."
    rebuild_remote_search_fts_index
  fi

  echo "Sync complete!"
}

main "$@"
