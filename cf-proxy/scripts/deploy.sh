#!/bin/bash
set -euo pipefail

bunx wrangler d1 migrations apply jlcsearch --remote
bash scripts/prepare-extended-promotional-search-rollout.sh
bunx wrangler deploy
