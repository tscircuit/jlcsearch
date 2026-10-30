# Component search identity

Text search used to join `search_index_fts.rowid` to `search_index.rowid`.
Catalog rebuilds assign new SQLite rowids, so a ready but older FTS index can
associate one component's search text with another component's identity. A live
`TTP223-BA6` lookup on 2026-10-28 returned the `HAOT10N65` MOSFET C42401279;
searching `HAOT10N65` returned an unrelated connector. This matches the failure
reported in [#611](https://github.com/tscircuit/jlcsearch/issues/611). The production
table contents have not been inspected directly.

The worker now requires FTS metadata `schema=2` and `ready=1`, joins by the LCSC
identifier stored in the index, and verifies tokens against current catalog text
before sorting and limiting results. Legacy, missing, and rebuilding indexes use
the existing catalog LIKE query. All catalog replacement scripts invalidate FTS
readiness before replacing the table. Both FTS builders populate LCSC identity.

## Rollout

1. Deploy the worker first. Its scoped cache namespace bypasses old component
   responses in KV, and legacy FTS uses the catalog query. Existing client or
   intermediary HTTP caches can remain valid until their cache lifetime expires.
2. Run `cd cf-proxy && bash scripts/rebuild-search-index-fts-batched.sh`,
   or the existing full-catalog sync, to restore indexed search performance.
   Run the standalone builder from `cf-proxy` so Wrangler finds its config.
3. Verify uncached `/components/list?search=TTP223-BA6&json=true&cachebust=1`
   and `/api/search?q=HAOT10N65&cachebust=1`. Results must match their query;
   an absent or unstocked part can legitimately produce an empty list.

The regression tests execute real SQLite FTS queries and the SQL catalog rebuild,
including a legacy index whose rowids now identify different components. The
sensor's numeric ID in the test is synthetic; no HTTP response is mocked.
