# Compact JLCPCB search catalog

Run `bun standalone-jlcsearch/build.ts [output.json.gz]` on a connected build machine.
The default selection captures 20 common LCSC identities, including RP2040,
resistors, capacitors, timers and amplifiers. Custom `queries` can select other
parts or families (up to 10 results per query). It deduplicates by LCSC ID and keeps only search
fields. It does not claim complete inventory or manufacture missing results.

The gzip payload is a UTF-8 JSON object:

- `schema_version`: `1`
- `source`: `jlcpcb`
- `coverage`: `subset`
- `generated_at`: ISO timestamp of capture
- `components`: search records with `lcsc`, `mfr`, `package`, `description`, `stock`,
  `price`, and optional basic/preferred/category/subcategory fields

Install it at `jlcsearch/search-catalog.json.gz` in the standalone baked asset
directory. The fake service searches the decompressed records locally;
queries need not match the captured query strings. Stock and prices are snapshots; null means unknown.
Missing parts return an empty result in a limited catalog, never a live fallback.

This catalog contains search metadata only. EasyEDA models, footprints, datasheets
and registry package contents must be bundled separately for offline imports.
`encodeCatalog` can also take selected records from a local database export.

Run the fake HTTP service directly with `bun standalone-jlcsearch/server.ts`
(default loopback port 3080; override with `PORT`). Point any normal API client
at the printed `TSCIRCUIT_JLCSEARCH_BASE_URL`. It implements GET/HEAD and form
POST `/api/search` with JLC IDs, keywords, limits and package/basic/preferred
filters. The CLI only uses the base URL and the normal API response contract.
