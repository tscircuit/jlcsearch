-- Create the D1 full-text index used by /api/search and /components/list.
-- Populate it with scripts/rebuild-search-index-fts-batched.sh so large D1
-- databases stay under Cloudflare's per-query CPU limit.

-- Preserve completed work across retries. Only the validated rebuild may
-- enable readiness again; old metadata must not enable a partial index.
CREATE TABLE IF NOT EXISTS search_index_fts_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR REPLACE INTO search_index_fts_meta(key, value) VALUES('ready_lcsc', '0');
UPDATE search_index_fts_meta SET value = '0' WHERE key = 'ready';

-- FTS rowid is the stable LCSC number, never a catalog insertion-order rowid.
CREATE VIRTUAL TABLE IF NOT EXISTS search_index_fts USING fts5(
  search_text,
  tokenize='trigram'
);

SELECT 'search_index_fts initialized' AS status;
