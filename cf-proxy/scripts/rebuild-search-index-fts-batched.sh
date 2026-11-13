#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FTS_BATCH_ROWS="${FTS_BATCH_ROWS:-5000}"

# Rebuild only FTS from the existing catalog. Do not run alongside another FTS
# rebuild or imports that change catalog IDs/text. Stock updates may continue.
# Restart this script after an interrupted run.
if [[ "$#" != 1 || ( "$1" != "--local" && "$1" != "--remote" ) || -z "${DB_NAME:-}" ]]; then
  echo "Usage: DB_NAME=<database> bash $0 --local|--remote" >&2
  echo "For an isolated local database, also set FTS_PERSIST_TO=<directory>." >&2
  exit 2
fi
if [[ ! "${FTS_BATCH_ROWS}" =~ ^[1-9][0-9]{0,3}$ ]] || (( FTS_BATCH_ROWS > 5000 )); then
  echo "FTS_BATCH_ROWS must be an integer from 1 to 5000." >&2
  exit 2
fi

LOCATION="$1"
WRANGLER_ARGS=(--config "${SCRIPT_DIR}/../wrangler.toml" "${LOCATION}" --json)
if [[ -n "${FTS_PERSIST_TO:-}" ]]; then
  if [[ "${LOCATION}" != "--local" ]]; then
    echo "FTS_PERSIST_TO is only supported with --local." >&2
    exit 2
  fi
  if [[ "${FTS_PERSIST_TO}" != /* ]]; then
    FTS_PERSIST_TO="${PWD}/${FTS_PERSIST_TO}"
  fi
  WRANGLER_ARGS+=(--persist-to "${FTS_PERSIST_TO}")
fi
if command -v bunx >/dev/null 2>&1; then
  WRANGLER_CMD=(bunx --no-install wrangler)
else
  WRANGLER_CMD=(npx --no-install wrangler)
fi

run_sql() (
  # Resolve the version installed in cf-proxy, regardless of the caller's cwd.
  cd "${SCRIPT_DIR}/.."
  bash "${SCRIPT_DIR}/retry-command.sh" "${WRANGLER_CMD[@]}" \
    d1 execute "${DB_NAME}" "${WRANGLER_ARGS[@]}" "$@"
)

# Fail closed on missing/malformed results instead of treating them as zero.
read_counts() {
  bun --eval '
    const response = JSON.parse(await Bun.stdin.text());
    if (!Array.isArray(response) || response.length !== 1 ||
        response[0].success !== true || response[0].results?.length !== 1) {
      throw new Error("Expected one successful D1 result row");
    }
    console.log(process.argv.slice(1).map(key => {
      const value = response[0].results[0][key];
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`Invalid D1 count: ${key}`);
      }
      return value;
    }).join(" "));
  ' "$@"
}

bounds_sql="SELECT
  COALESCE((SELECT MIN(rowid) FROM search_index), 0) AS min_rowid,
  COALESCE((SELECT MAX(rowid) FROM search_index), 0) AS max_rowid;"
bounds="$(run_sql --command "${bounds_sql}" | read_counts min_rowid max_rowid)"
read -r min_rowid max_rowid <<< "${bounds}"
if (( min_rowid == 0 || max_rowid == 0 )); then
  echo "Refusing to replace FTS: the search catalog is empty or has non-positive rowids." >&2
  exit 1
fi

echo "Rebuilding FTS for ${DB_NAME} (${LOCATION}); keep catalog imports paused until this finishes."
echo "Initializing search_index_fts with readiness disabled..."
run_sql --file="${SCRIPT_DIR}/setup-fts5.sql" > /dev/null

for ((start=min_rowid; start<=max_rowid; start+=FTS_BATCH_ROWS)); do
  end=$((start + FTS_BATCH_ROWS - 1))
  if (( end > max_rowid )); then end=${max_rowid}; fi

  echo "Importing FTS source rowids ${start}-${end}..."
  # REPLACE is safe to retry if D1 committed a batch but its reply was lost.
  run_sql --command "
    INSERT OR REPLACE INTO search_index_fts(rowid, search_text)
    SELECT lcsc, search_text FROM search_index
    WHERE rowid BETWEEN ${start} AND ${end}
      AND search_text IS NOT NULL AND search_text != '';
  " > /dev/null
done

echo "Validating every searchable part against its LCSC ID and text..."
expected_total=0
for ((start=min_rowid; start<=max_rowid; start+=FTS_BATCH_ROWS)); do
  end=$((start + FTS_BATCH_ROWS - 1))
  if (( end > max_rowid )); then end=${max_rowid}; fi
  counts="$(run_sql --command "
    SELECT COUNT(*) AS expected_count,
      COALESCE(SUM(CASE WHEN typeof(s.lcsc) != 'integer' OR s.lcsc <= 0
        OR (SELECT f.search_text FROM search_index_fts AS f WHERE f.rowid = s.lcsc) IS NOT s.search_text
        THEN 1 ELSE 0 END), 0) AS mismatches
    FROM search_index AS s
    WHERE s.rowid BETWEEN ${start} AND ${end}
      AND s.search_text IS NOT NULL AND s.search_text != '';
  " | read_counts expected_count mismatches)"
  read -r expected_count mismatches <<< "${counts}"
  if (( mismatches != 0 )); then
    echo "FTS validation failed for source rowids ${start}-${end}: ${mismatches} missing, invalid, or mismatched entries. Index remains disabled." >&2
    exit 1
  fi
  expected_total=$((expected_total + expected_count))
done

# Count FTS entries in bounded chunks too. Combined with the text checks, this
# detects duplicate source IDs and extra/stale index entries.
actual_total=0
last_id=0
while true; do
  counts="$(run_sql --command "
    SELECT COUNT(*) AS actual_count, COALESCE(MAX(rowid), 0) AS last_id
    FROM (SELECT rowid FROM search_index_fts WHERE rowid > ${last_id}
      ORDER BY rowid LIMIT ${FTS_BATCH_ROWS});
  " | read_counts actual_count last_id)"
  read -r actual_count last_id <<< "${counts}"
  actual_total=$((actual_total + actual_count))
  if (( actual_count < FTS_BATCH_ROWS )); then break; fi
done

current_bounds="$(run_sql --command "${bounds_sql}" | read_counts min_rowid max_rowid)"
if [[ "${current_bounds}" != "${bounds}" ]] || (( expected_total == 0 || actual_total != expected_total )); then
  echo "FTS validation failed: catalog changed, is unsearchable, or entry counts differ (${expected_total} expected, ${actual_total} indexed). Index remains disabled." >&2
  exit 1
fi

# Full FTS optimize is optional maintenance and can exceed D1's work limit.
ready="$(run_sql --command "
  UPDATE search_index_fts_meta SET value = '1' WHERE key = 'ready_lcsc'
  RETURNING CAST(value AS INTEGER) AS enabled;
" | read_counts enabled)"
if [[ "${ready}" != "1" ]]; then
  echo "Failed to confirm FTS readiness." >&2
  exit 1
fi
echo "search_index_fts rebuild complete: ${actual_total} validated entries."
