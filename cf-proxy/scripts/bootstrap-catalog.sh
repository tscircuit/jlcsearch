#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-jlcsearch}"

if command -v bunx >/dev/null 2>&1; then
  WRANGLER_CMD=(bunx wrangler)
else
  WRANGLER_CMD=(npx wrangler)
fi

"${WRANGLER_CMD[@]}" d1 execute "${DB_NAME}" --remote \
  --file="${SCRIPT_DIR}/../migrations/0000_catalog_bootstrap.sql"
