#!/bin/bash
set -euo pipefail

bash scripts/bootstrap-catalog.sh
bunx wrangler d1 migrations apply jlcsearch --remote
bunx wrangler d1 execute jlcsearch --remote --command "SELECT extended_promotional FROM component_catalog LIMIT 0; SELECT extended_promotional FROM search_index LIMIT 0;"
bash scripts/rebuild-search-index-batched.sh
bash scripts/rebuild-search-index-fts-batched.sh
bunx wrangler deploy
