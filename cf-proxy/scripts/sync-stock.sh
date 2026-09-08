#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DB_NAME="${DB_NAME:-jlcsearch}"
SOURCE_DB_PATH="${SOURCE_DB_PATH:-${REPO_ROOT}/db.sqlite3}"
STOCK_BATCH_ROWS="${STOCK_BATCH_ROWS:-1000}"
STOCK_SYNC_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/jlcsearch-stock-sync.XXXXXX")"

if command -v bunx >/dev/null 2>&1; then
  WRANGLER_CMD=(bunx wrangler)
else
  WRANGLER_CMD=(npx wrangler)
fi

run_wrangler() {
  bash "${SCRIPT_DIR}/retry-command.sh" "${WRANGLER_CMD[@]}" "$@"
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

if [[ ! "${STOCK_BATCH_ROWS}" =~ ^[1-9][0-9]{0,3}$ ]] || (( STOCK_BATCH_ROWS > 1000 )); then
  echo "STOCK_BATCH_ROWS must be an integer between 1 and 1000." >&2
  exit 1
fi

echo "Reading deployed D1 tables and promotional-flag columns..."
schema_query="$(cd "${REPO_ROOT}" && bun scripts/generate-stock-sync-sql.ts --schema-query)"
schema_file="${STOCK_SYNC_TEMP_DIR}/target-schema.json"
# Overwrite the JSON file on each attempt so retry diagnostics cannot become
# part of the response parsed by the generator.
bash "${SCRIPT_DIR}/retry-command.sh" bash -c \
  'stock_schema_file="$1"; shift; "$@" > "${stock_schema_file}"' \
  _ "${schema_file}" "${WRANGLER_CMD[@]}" \
  d1 execute "${DB_NAME}" --remote --json --command "${schema_query}"

echo "Generating stock and promotional-flag D1 update batches..."
(
  cd "${REPO_ROOT}"
  SOURCE_DB_PATH="${SOURCE_DB_PATH}" \
    STOCK_SYNC_OUTPUT_DIR="${STOCK_SYNC_TEMP_DIR}/batches" \
    STOCK_SYNC_SCHEMA_PATH="${schema_file}" \
    STOCK_BATCH_ROWS="${STOCK_BATCH_ROWS}" \
    bun run scripts/generate-stock-sync-sql.ts
)

shopt -s nullglob
batch_files=("${STOCK_SYNC_TEMP_DIR}"/batches/batch-*.sql)
if [[ "${#batch_files[@]}" -eq 0 ]]; then
  echo "Stock sync did not generate any update batches." >&2
  exit 1
fi

batch_count="${#batch_files[@]}"
batch_number=0
for batch_file in "${batch_files[@]}"; do
  batch_number=$((batch_number + 1))
  batch_sql="$(<"${batch_file}")"
  echo "Updating stock/promotional batch ${batch_number}/${batch_count}..."
  # Generated commands are <=100KB, including all contained statements.
  # Keep the query endpoint: --file uses a blocking database import instead.
  run_wrangler d1 execute "${DB_NAME}" --remote --command "${batch_sql}"
done

echo "Stock and promotional-flag sync complete."
