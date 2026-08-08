# jlcsearch (in-stock jlcpcb search engine and API)

[Search for Parts](https://jlcsearch.tscircuit.com) ⋅ [tscircuit](https://github.com/tscircuit/tscircuit) ⋅ [discord](https://tscircuit.com/join)

This is an in-stock parts search engine for JLCPCB parts. It also
features an easy-to-use API (just add ".json" to your URL on any page)

Play with it at [jlcsearch.tscircuit.com](https://jlcsearch.tscircuit.com)

![image](https://github.com/user-attachments/assets/bf036e76-f67d-47f6-b1f8-01de0dfe3fd2)

## API Usage

You can go on any page and click "json" in the top right corner to automatically convert whatever filter you've made to a JSON query.

```bash
curl https://jlcsearch.tscircuit.com/resistors/list.json?package=&resistance=1k

# {
#  "resistors": [
#    {
#      "lcsc": 21190,
#      "mfr": "0603WAF1001T5E",
#      "package": "0603",
#      "resistance": 1000,
#      "tolerance_fraction": 0.01,
#      "power_watts": 100,
#      "stock": 31485061,
#      "price1": 0.000814286
#    },
#    {
#      "lcsc": 11702,
#      "mfr": "0402WGF1001TCE",
#      "package": "0402",
#      "resistance": 1000,
#      ...
```

## Development

[Bun](https://bun.com/) is required. Install dependencies for both the data
pipeline and Cloudflare worker:

```bash
bun install
bun install --cwd cf-proxy
```

Run `bun start` to start the Cloudflare worker locally. The production site is
implemented entirely in `cf-proxy`; there is no separate origin web server.

To add a component page:

1. Add or update its derived-table definition in `lib/db/derivedtables`.
2. Register the table in `cf-proxy/scripts/sync-db.sh` so it is copied to D1.
3. Add the D1 type, filter configuration, route mapping, response key, and page
   label under `cf-proxy/src`.
4. Add worker rendering and route tests under `cf-proxy/test`.
5. Run `bun run format`, `bunx tsc --noEmit --project cf-proxy/tsconfig.json`,
   and `bun run test --cwd cf-proxy`.

Use `bun deploy` to apply pending D1 schema migrations and then publish the
worker. Use `cf-proxy/scripts/sync-db.sh` to rebuild and synchronize derived
table data from a prepared local SQLite database.

Production D1 data is populated by the **Build and Sync D1** GitHub Actions
workflow. Every night at 05:00 UTC, after the upstream jlcparts refresh, it
performs a `stock_only` sync and clears the production response cache. The
stock-only path updates changed values in `component_catalog` and `search_index`
without rebuilding either table or the FTS index. Its compact stock snapshot
also sets recently removed parts to zero instead of leaving stale quantities.
API clients are instructed to revalidate within 24 hours so the nightly stock
snapshot is not hidden by an older response. On relevant merges to `main`, the
workflow
downloads the current upstream source-db-v2 database, builds and verifies a
compact `db.sqlite3` containing the requested derived tables, applies D1
migrations, uploads those tables, and refreshes the affected production API
cache. Transient Cloudflare failures during migrations or upload are retried
per D1 command with incremental delays. Upload batches are
idempotent, so a lost import-status response can be retried without duplicating
rows or restarting completed work. Full-catalog uploads use 1,000-row batches
for catalog tables, 5,000-row batches for FTS, up to six attempts per D1
command, and a three-hour job timeout so the component catalog and search index
can finish before the next upstream refresh. The workflow can also be run
manually in `derived`, `stock_only`, or `full_catalog` mode. `derived` accepts a
comma-separated `derived_tables` input. `stock_only` performs the same in-place
stock refresh used by the nightly schedule. `full_catalog` rebuilds and uploads
the component catalog, search index, and FTS index from the current source-db-v2
snapshot. Catalog and stock syncs require a numeric `smoke_test_lcsc` whose
remote stock must match the prepared source database. All modes accept an
optional `cache_bust_url`. The workflow requires the
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` repository secrets.

## How Does It work?
As a developer new to this codebase, or a curious user, you may have some questions about the flow of data through the scripts and automations inside this repo.  It all starts with the [jlcparts](https://github.com/yaqwsx/jlcparts) project, which compiles a massive **11GB** sqlite3 database of *everything* [JLCPCB](https://jlcpcb.com) has to offer.  As you can imagine, this would be very resource-intensive and slow to search, so the next steps are scripts that optimize it heavily, although it's more accurate to say that they rebuild it entirely. 
`scripts/setup-db-optimizations.ts` and `scripts/setup-derived-tables.ts` show the various optimizations that are performed, including:
- Removing stale components that haven't been in stock for over a year.
- Only keeping categories of components that we are currently interested in and have a schema defined for (see the corresponding component types in `lib/db/derivedtables` for examples).
- Adding columns for traits that we care about such as price, stock level, and basic/ preferred status (to save on assembly costs).

The result is `db.sqlite3` which presently comes in at **under 2GB** in size. 

If you wish to use some data that exists in the [jlcparts](https://github.com/yaqwsx/jlcparts) database but is not yet being brought over to the optimized `db.sqlite3`, you can look at the originating database to get familiar with it and find the data structures you wish to bring over.  An easy way to do this can be: after you have run `bun run setup` and it has completed, the cache zip archive files are still located at `./buildtmp` - simply unpack these yourself (preferably into a separate directory outside of the project) and there is your 11GB `cache.sqlite3` database to look at.  

To recap:
- If you wish to use additional **component data** (like the basic/ preferred status) that exists in [jlcparts](https://github.com/yaqwsx/jlcparts), it won't be in the optimized `db.sqlite3` (and thus jlcsearch won't know about it) until you add it via a script in `lib/db/optimizations/` and then call it in `scripts/setup-db-optimizations.ts`.  You should then do `bun run setup` again to rebuild the optimized database with your new data.  
- If you wish to add additional **component types** (like gyroscopes or Molex connectors) you would need to set up a new schema for them in `lib/db/derivedtables` and then do `bun run generate:db-types` to generate the new table types as per the Development section above.


## Acknowledgements

None of this would be possible without [JLCPCB](https://jlcpcb.com) and the work
[jlcparts](https://github.com/yaqwsx/jlcparts) project.
