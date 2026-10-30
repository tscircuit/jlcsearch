-- Create the D1 full-text index used by /api/search and /components/list.
-- Populate it with scripts/rebuild-search-index-fts-batched.sh so large D1
-- databases stay under Cloudflare's per-query CPU limit.
--
-- The worker joins search_index_fts to search_index on lcsc, not rowid, so a
-- rebuilt search_index (new rowids) keeps matching the right parts. The
-- schema row tells the worker the index carries lcsc; an older index without
-- it is ignored and the worker falls back to a LIKE search on search_index.

DROP TABLE IF EXISTS search_index_fts;
DROP TABLE IF EXISTS search_index_fts_meta;

CREATE VIRTUAL TABLE search_index_fts USING fts5(
  search_text,
  lcsc UNINDEXED,
  tokenize='trigram'
);

CREATE TABLE search_index_fts_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO search_index_fts_meta(key, value) VALUES('ready', '0');
INSERT INTO search_index_fts_meta(key, value) VALUES('schema', '2');

SELECT 'search_index_fts initialized' AS status;
