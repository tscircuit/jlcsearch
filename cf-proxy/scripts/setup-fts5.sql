-- Create the D1 full-text index used by /api/search and /components/list.
-- Populate it with scripts/rebuild-search-index-fts-batched.sh so large D1
-- databases stay under Cloudflare's per-query CPU limit.

DROP TABLE IF EXISTS search_index_fts;
DROP TABLE IF EXISTS search_index_fts_meta;

CREATE VIRTUAL TABLE search_index_fts USING fts5(
  search_text,
  tokenize='trigram'
);

CREATE TABLE search_index_fts_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO search_index_fts_meta(key, value) VALUES('ready', '0');

SELECT 'search_index_fts initialized' AS status;
