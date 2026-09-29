#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DB_NAME="${DB_NAME:-jlcsearch}"
SOURCE_DB_PATH="${SOURCE_DB_PATH:-${REPO_ROOT}/db.sqlite3}"
STOCK_BATCH_ROWS="${STOCK_BATCH_ROWS:-1000}"
STOCK_SYNC_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/jlcsearch-stock-sync.XXXXXX")"
DERIVED_STOCK_TABLES=(
  accelerometer
  adc
  analog_multiplexer
  barrel_jack
  battery_holder
  bjt_transistor
  ble_chip
  ble_module
  boost_converter
  buck_boost_converter
  capacitor
  dac
  diode
  dram
  dimm_connector
  fpc_connector
  fpga
  fuse
  gas_sensor
  gyroscope
  header
  hdmi_port
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
  micro_usb_connector
  mosfet
  oled_display
  pcie_m2_connector
  photo_diode
  potentiometer
  relay
  resistor
  resistor_array
  sodimm_connector
  spring_clamp_terminal_block
  switch
  usb_c_connector
  voltage_regulator
  wifi_module
  wire_to_board_connector
)
EXISTING_DERIVED_STOCK_TABLES=()
HAS_SEARCH_INDEX=0

if command -v bunx >/dev/null 2>&1; then
  WRANGLER_CMD=(bunx wrangler)
else
  WRANGLER_CMD=(npx wrangler)
fi

run_wrangler() {
  bash "${SCRIPT_DIR}/retry-command.sh" "${WRANGLER_CMD[@]}" "$@"
}

quote_identifier() {
  local identifier="$1"
  if [[ ! "${identifier}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "Invalid SQL identifier: ${identifier}" >&2
    exit 1
  fi
  printf '"%s"' "${identifier}"
}

remote_query_json() {
  local output_file="$1"
  shift
  run_wrangler d1 execute "${DB_NAME}" --remote --json "$@" > "${output_file}"
}

remote_table_exists() {
  local table="$1"
  local result_file="${STOCK_SYNC_TEMP_DIR}/table-${table}.json"
  remote_query_json "${result_file}" --command \
    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='${table}') AS table_exists;"
  [[ "$(jq -r '.[0].results[0].table_exists // 0' "${result_file}")" == "1" ]]
}

remote_column_exists() {
  local table="$1"
  local column="$2"
  local result_file="${STOCK_SYNC_TEMP_DIR}/columns-${table}.json"
  remote_query_json "${result_file}" --command \
    "PRAGMA table_info($(quote_identifier "${table}"));"
  jq -e --arg column "${column}" \
    '.[0].results | any(.name == $column)' "${result_file}" >/dev/null
}

ensure_remote_column() {
  local table="$1"
  local column="$2"
  local type="$3"
  if remote_column_exists "${table}" "${column}"; then
    return
  fi

  echo "Adding ${table}.${column} to remote D1 schema..."
  run_wrangler d1 execute "${DB_NAME}" --remote --command \
    "ALTER TABLE $(quote_identifier "${table}") ADD COLUMN $(quote_identifier "${column}") ${type};"
}

select_derived_stock_tables() {
  if [[ -z "${DERIVED_STOCK_TABLES_LIST:-}" ]]; then
    return
  fi

  local requested raw_table table
  local selected=()
  IFS=',' read -r -a requested <<< "${DERIVED_STOCK_TABLES_LIST}"
  for raw_table in "${requested[@]}"; do
    table="$(echo "${raw_table}" | xargs)"
    if [[ -z "${table}" ]]; then
      continue
    fi
    if [[ ! "${table}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      echo "Invalid derived stock table: ${table}" >&2
      exit 1
    fi
    selected+=("${table}")
  done

  if [[ "${#selected[@]}" -eq 0 ]]; then
    echo "DERIVED_STOCK_TABLES_LIST did not resolve to any tables." >&2
    exit 1
  fi

  DERIVED_STOCK_TABLES=("${selected[@]}")
}

ensure_stock_sync_schema() {
  if ! remote_table_exists component_catalog; then
    echo "Remote component_catalog does not exist; run a full_catalog sync before stock_only." >&2
    exit 1
  fi

  ensure_remote_column component_catalog is_extended_promotional INTEGER

  if remote_table_exists search_index; then
    HAS_SEARCH_INDEX=1
    ensure_remote_column search_index is_extended_promotional INTEGER
  else
    echo "Remote search_index does not exist; skipping search index propagation."
  fi

  for table in "${DERIVED_STOCK_TABLES[@]}"; do
    if ! remote_table_exists "${table}"; then
      continue
    fi

    ensure_remote_column "${table}" is_extended_promotional INTEGER
    EXISTING_DERIVED_STOCK_TABLES+=("${table}")
  done
}

propagate_stock_classification() {
  local lcsc_file="$1"
  local propagation_sql
  local target_args=()

  if [[ ! -s "${lcsc_file}" ]]; then
    echo "Missing or empty stock propagation LCSC batch: ${lcsc_file}" >&2
    exit 1
  fi

  if [[ "${HAS_SEARCH_INDEX}" == "1" ]]; then
    target_args+=(--search-index)
  fi
  target_args+=("${EXISTING_DERIVED_STOCK_TABLES[@]}")

  if [[ "${#target_args[@]}" -eq 0 ]]; then
    return
  fi

  echo "Propagating stock classification from component_catalog to served tables..."
  propagation_sql="$(
    cd "${REPO_ROOT}"
    bun run scripts/stock-sync-propagation-sql.ts combined "${lcsc_file}" "${target_args[@]}"
  )"
  run_wrangler d1 execute "${DB_NAME}" --remote --command "${propagation_sql}"
}

cleanup() {
  if [[ "${KEEP_SYNC_TEMP:-0}" != "1" ]]; then
    rm -rf "${STOCK_SYNC_TEMP_DIR}"
  fi
}

trap cleanup EXIT

if [[ ! -s "${SOURCE_DB_PATH}" ]]; then
  echo "Source database does not exist or is empty: ${SOURCE_DB_PATH}" >&2
  exit 1
fi

if [[ ! "${STOCK_BATCH_ROWS}" =~ ^[1-9][0-9]*$ ]]; then
  echo "STOCK_BATCH_ROWS must be a positive integer." >&2
  exit 1
fi

select_derived_stock_tables

echo "Preparing remote stock-only schema..."
ensure_stock_sync_schema

echo "Generating stock-only D1 update batches..."
(
  cd "${REPO_ROOT}"
  SOURCE_DB_PATH="${SOURCE_DB_PATH}" \
    STOCK_SYNC_OUTPUT_DIR="${STOCK_SYNC_TEMP_DIR}" \
    STOCK_BATCH_ROWS="${STOCK_BATCH_ROWS}" \
    bun run scripts/generate-stock-sync-sql.ts
)

shopt -s nullglob
batch_files=("${STOCK_SYNC_TEMP_DIR}"/batch-*.sql)
if [[ "${#batch_files[@]}" -eq 0 ]]; then
  echo "Stock sync did not generate any update batches." >&2
  exit 1
fi

batch_count="${#batch_files[@]}"
batch_number=0
for batch_file in "${batch_files[@]}"; do
  batch_number=$((batch_number + 1))
  lcsc_file="${batch_file%.sql}.lcsc"
  if [[ ! -s "${lcsc_file}" ]]; then
    echo "Missing stock propagation LCSC file for ${batch_file}: ${lcsc_file}" >&2
    exit 1
  fi
  batch_sql="$(<"${batch_file}")"
  echo "Updating stock batch ${batch_number}/${batch_count}..."
  run_wrangler d1 execute "${DB_NAME}" --remote --command "${batch_sql}"
  propagate_stock_classification "${lcsc_file}"
done

echo "Stock-only sync complete."
