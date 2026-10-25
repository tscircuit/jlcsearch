# Component search index identity

`search_index` is recreated during catalog imports and table swaps. Its SQLite
rowids are storage locations, not component identities. Joining an older FTS
index by rowid can therefore return an unrelated part for an exact MCU query.

The worker joins FTS rows using the stable `lcsc` value and checks text matches
against the current catalog as well. An FTS index is usable only when its metadata
contains both `ready=1` and `schema_version=2`. Missing, legacy or rebuilding
indexes use the existing catalog LIKE query, preserving stock and query filters.
Direct LCSC lookups do not depend on FTS.

## Rollout

1. Deploy the worker first. Legacy FTS metadata selects the LIKE fallback, and
   the new component-search cache namespace prevents serving previously cached
   incorrect matches. Cache keys for other catalog routes are unchanged.
2. Rebuild FTS using the existing `fts_only` D1 workflow mode, a `full_catalog`
   sync, or `cf-proxy/scripts/rebuild-search-index-fts-batched.sh`. Both index
   builders populate the new LCSC column and mark the index ready only after all
   batches succeed. A failed rebuild leaves search on the LIKE fallback.
3. Check `/api/search?q=DA14531&cachebust=1` and
   `/api/search?q=ATSAML10E16A&cachebust=1`, followed by the same URLs without
   `cachebust`. Every result must match the query in the current catalog text;
   an empty result remains valid when the catalog has no eligible stocked part.

Rebuilding only `search_index` can make FTS incomplete, but it can no longer
redirect a text match to a different component. Rebuild FTS after a catalog
refresh to restore coverage. Missing parts in the source catalog require a full
catalog refresh; this fix does not alter the catalog or stock policy.
