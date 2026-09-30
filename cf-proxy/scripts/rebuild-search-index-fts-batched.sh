#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-jlcsearch}"
FTS_BATCH_ROWS="${FTS_BATCH_ROWS:-5000}"
MAX_ROWID="${MAX_ROWID:-}"

if command -v bunx >/dev/null 2>&1; then
  WRANGLER_CMD=(bunx wrangler)
else
  WRANGLER_CMD=(npx wrangler)
fi

run_wrangler() {
  bash "${SCRIPT_DIR}/retry-command.sh" "${WRANGLER_CMD[@]}" "$@"
}

if [[ -z "${MAX_ROWID}" ]]; then
  MAX_ROWID="$(
    run_wrangler d1 execute "${DB_NAME}" --remote --json \
      --command "SELECT MAX(rowid) AS max_rowid FROM search_index;" |
      bun --eval '
        const chunks = [];
        for await (const chunk of Bun.stdin.stream()) chunks.push(chunk);
        const text = Buffer.concat(chunks).toString();
        const json = JSON.parse(text.slice(text.indexOf("[")));
        console.log(json[0]?.results?.[0]?.max_rowid ?? 0);
      '
  )"
fi

echo "Initializing search_index_fts..."
run_wrangler d1 execute "${DB_NAME}" --remote --command "$(cat "${SCRIPT_DIR}/setup-fts5.sql")"

for ((start=1; start<=MAX_ROWID; start+=FTS_BATCH_ROWS)); do
  end=$((start + FTS_BATCH_ROWS - 1))
  if (( end > MAX_ROWID )); then
    end=${MAX_ROWID}
  fi

  echo "Importing FTS rowids ${start}-${end}..."
  run_wrangler d1 execute "${DB_NAME}" --remote --command "
    DELETE FROM search_index_fts WHERE rowid BETWEEN ${start} AND ${end};
    INSERT INTO search_index_fts(rowid, search_text)
    SELECT rowid, search_text
    FROM search_index
    WHERE rowid BETWEEN ${start} AND ${end}
      AND search_text IS NOT NULL
      AND search_text != '';
  "
done

echo "Marking search_index_fts ready..."
run_wrangler d1 execute "${DB_NAME}" --remote --command "
  UPDATE search_index_fts_meta SET value = '1' WHERE key = 'ready';
"

echo "Verifying indexed row coverage..."
verification="$(run_wrangler d1 execute "${DB_NAME}" --remote --json --command "
  SELECT
    (SELECT COUNT(*) FROM search_index WHERE search_text IS NOT NULL AND search_text != '') AS expected,
    (SELECT COUNT(*) FROM search_index_fts) AS actual,
    (SELECT value FROM search_index_fts_meta WHERE key = 'ready') AS ready;
")"
echo "${verification}" | bun --eval '
  const text = await Bun.stdin.text();
  const row = JSON.parse(text.slice(text.indexOf("[")))[0]?.results?.[0];
  if (!row || row.expected !== row.actual || row.ready !== "1") {
    console.error("FTS coverage verification failed", row);
    process.exit(1);
  }
  console.log(`Verified ${row.actual} full-text search records.`);
'
echo "search_index_fts rebuild complete."
