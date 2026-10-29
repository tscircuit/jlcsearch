# Deploying and rebuilding component search

Run these commands from `cf-proxy/`, where Wrangler can find its configuration.
The scripts use `DB_NAME=jlcsearch` by default. When targeting another database,
set `DB_NAME` for both rebuild scripts and use that name in verification commands.

## First deployment

Deploy the Worker before rebuilding FTS:

```sh
cd cf-proxy
bun run deploy
bash scripts/rebuild-search-index-fts-batched.sh
```

The Worker uses catalog text while the FTS index lacks `rowid_source=lcsc` or
has `ready=0`. This keeps searches correct during the transition, but the
fallback can be slower. The FTS builder runs `setup-fts5.sql`, loads all batches
using LCSC numbers as FTS row IDs, then marks the index ready.

## Subsequent catalog rebuilds

`sync-db.sh` rebuilds FTS automatically when `SYNC_SEARCH_INDEX=1`. A standalone
catalog rebuild requires both commands, in order:

```sh
bash scripts/rebuild-search-index-batched.sh &&
  bash scripts/rebuild-search-index-fts-batched.sh
```

The table swap disables the previous FTS index. Do not stop after the first
command: searches remain on the catalog fallback until the second completes.
Applying `rebuild-search-index-from-component-catalog.sql` directly also requires
the FTS rebuild afterward.

## Verify completion

```sh
bunx wrangler d1 execute jlcsearch --remote --command \
  "SELECT key, value FROM search_index_fts_meta WHERE key IN ('ready', 'rowid_source');"
```

Expect `ready=1` and `rowid_source=lcsc`. Check an exact and a partial search
without reusing a cached response, for example:

```sh
curl --fail 'https://jlcsearch.tscircuit.com/api/search?q=PJ-320D&cachebust=1'
curl --fail 'https://jlcsearch.tscircuit.com/components/list.json?search=XC6206&cachebust=1'
```

Returned parts should match the query; an absent, filtered, or unstocked part
can legitimately produce no results. Client or intermediary caches may retain
older responses until their cache lifetime expires.

## Recover from failure

The FTS builder exits when a command fails and only sets `ready=1` after all
batches and its final maintenance command succeed. Searches continue using the
catalog fallback while readiness is disabled or metadata is missing.

Resolve the reported error, then rerun `rebuild-search-index-fts-batched.sh`.
It recreates FTS and starts from the beginning; a successfully imported catalog
does not need to be uploaded again. Do not set readiness manually to bypass a
failed rebuild. If the catalog rebuild itself failed, complete that rebuild
before rebuilding FTS.

## Performance validation

Production D1 timing has not been measured for this change. Before rollout,
measure an exact part query and a common-token query on a separate database with
representative catalog size. Compare the ready FTS path with the catalog fallback
and record database query duration separately from HTTP/cache/network latency.
Local SQLite regression tests do not establish production D1 performance.
