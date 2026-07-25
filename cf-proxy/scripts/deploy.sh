#!/bin/bash
set -euo pipefail

bunx wrangler d1 migrations apply jlcsearch --remote
bunx wrangler deploy
