#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-jlcsearch}"
REQUIRE_PROMOTIONAL_SEARCH_TABLES="${REQUIRE_PROMOTIONAL_SEARCH_TABLES:-1}"
ROLLOUT_BACKFILL_ROWS="${ROLLOUT_BACKFILL_ROWS:-1000}"
ROLLOUT_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/jlcsearch-promotional-rollout.XXXXXX")"

if command -v bunx >/dev/null 2>&1; then
  WRANGLER_CMD=(bunx wrangler)
else
  WRANGLER_CMD=(npx wrangler)
fi

cleanup() {
  if [[ "${KEEP_ROLLOUT_TEMP:-0}" != "1" ]]; then
    rm -rf "${ROLLOUT_TEMP_DIR}"
  fi
}

trap cleanup EXIT

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command '${command_name}' is not installed." >&2
    exit 1
  fi
}

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
  local result_file="${ROLLOUT_TEMP_DIR}/table-${table}.json"
  remote_query_json "${result_file}" --command \
    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='${table}') AS table_exists;"
  [[ "$(jq -r '.[0].results[0].table_exists // 0' "${result_file}")" == "1" ]]
}

remote_column_exists() {
  local table="$1"
  local column="$2"
  local result_file="${ROLLOUT_TEMP_DIR}/columns-${table}.json"
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

require_positive_integer() {
  local name="$1"
  local value="$2"
  if [[ ! "${value}" =~ ^[1-9][0-9]*$ ]]; then
    echo "${name} must be a positive integer." >&2
    exit 1
  fi
}

get_remote_max_rowid() {
  local table="$1"
  local result_file="${ROLLOUT_TEMP_DIR}/max-rowid-${table}.json"
  local max_rowid

  remote_query_json "${result_file}" --command \
    "SELECT MAX(rowid) AS max_rowid FROM $(quote_identifier "${table}");"
  max_rowid="$(jq -r '.[0].results[0].max_rowid // 0' "${result_file}")"
  if [[ ! "${max_rowid}" =~ ^[0-9]+$ ]]; then
    echo "Invalid max rowid for ${table}: ${max_rowid}" >&2
    exit 1
  fi

  echo "${max_rowid}"
}

backfill_component_catalog() {
  local max_rowid start end
  max_rowid="$(get_remote_max_rowid component_catalog)"
  if [[ "${max_rowid}" == "0" ]]; then
    return
  fi

  for ((start=1; start<=max_rowid; start+=ROLLOUT_BACKFILL_ROWS)); do
    end=$((start + ROLLOUT_BACKFILL_ROWS - 1))
    if (( end > max_rowid )); then
      end="${max_rowid}"
    fi

    echo "Backfilling component_catalog rows ${start}-${end}..."
    run_wrangler d1 execute "${DB_NAME}" --remote --command "
      UPDATE component_catalog
      SET is_extended_promotional = CASE
        WHEN basic = 0 AND preferred = 1 THEN 1
        ELSE 0
      END
      WHERE rowid BETWEEN ${start} AND ${end}
        AND is_extended_promotional IS NULL;
    "
  done
}

backfill_search_index() {
  local max_rowid start end
  max_rowid="$(get_remote_max_rowid search_index)"
  if [[ "${max_rowid}" == "0" ]]; then
    return
  fi

  for ((start=1; start<=max_rowid; start+=ROLLOUT_BACKFILL_ROWS)); do
    end=$((start + ROLLOUT_BACKFILL_ROWS - 1))
    if (( end > max_rowid )); then
      end="${max_rowid}"
    fi

    echo "Backfilling search_index rows ${start}-${end}..."
    run_wrangler d1 execute "${DB_NAME}" --remote --command "
      UPDATE search_index
      SET is_extended_promotional = COALESCE(
        (
          SELECT source.is_extended_promotional
          FROM component_catalog AS source
          WHERE source.lcsc = search_index.lcsc
        ),
        CASE
          WHEN basic = 0 AND preferred = 1 THEN 1
          ELSE 0
        END
      )
      WHERE rowid BETWEEN ${start} AND ${end}
        AND is_extended_promotional IS NULL;
    "
  done
}

require_rollout_table() {
  local table="$1"
  if [[ "${REQUIRE_PROMOTIONAL_SEARCH_TABLES}" == "1" ]]; then
    echo "Remote ${table} does not exist; run a full_catalog sync before deploying the Worker." >&2
    exit 1
  fi

  echo "Remote ${table} does not exist; full_catalog will create the canonical schema."
}

prepare_component_catalog() {
  if ! remote_table_exists component_catalog; then
    require_rollout_table component_catalog
    return
  fi

  ensure_remote_column component_catalog is_extended_promotional INTEGER
  backfill_component_catalog
}

prepare_search_index() {
  if ! remote_table_exists search_index; then
    require_rollout_table search_index
    return
  fi

  ensure_remote_column search_index is_extended_promotional INTEGER
  backfill_search_index
}

require_command jq
require_positive_integer ROLLOUT_BACKFILL_ROWS "${ROLLOUT_BACKFILL_ROWS}"

echo "Preparing extended promotional search rollout schema..."
prepare_component_catalog
prepare_search_index
echo "Promotional rollout index creation is handled by full_catalog/search-index rebuild paths."
echo "Extended promotional search rollout schema is ready."
