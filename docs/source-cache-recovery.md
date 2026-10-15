# Recovering parts missing from the upstream cache

The September 14, 2026 jlcparts cache reset removed older catalog records.
The recovery source is the last complete published cache at commit
`75daa67a78f3acf4ce18bab8dd68a86ac28c2818`, containing 7,161,863 JLC records.
Every archive volume is checked against the Git blob SHA-1 and size recorded in
`scripts/source-recovery-manifest.json`. SQLite validates the resulting prepared
database before upload.

The sync reads current upstream rows first and uses recovery rows only for
missing LCSC IDs. Current zero stock and explicit removals take precedence.
Neither source database is modified. LCSC metadata is merged with the same
precedence. The recovered rows feed derived tables, global search/catalog, and
stock snapshots, so subsequent syncs do not erase the restored parts.

Recovery restores catalog coverage, **not universally current stock or prices**.
The snapshot was published in September, but individual records can have older
fetch dates (W5500 was last fetched in June). The live Ethernet Controllers API
is therefore fetched separately and validated before replacing the prepared
Ethernet table. Its current stock and prices also replace matching prepared
catalog rows, and its stock replaces matching stock-snapshot rows. Full-catalog
syncs rebuild global search from that refreshed catalog. Nightly stock runs
refresh both global stock and the Ethernet category.

## Manual production recovery

Run the **Build and Sync D1** workflow on the branch containing this patch:

1. Choose `sync_scope=full_catalog` and leave `recover_missing_parts=true`.
   This restores missing global catalog/search records and refreshes Ethernet
   catalog records from JLCPCB. The full upload can take hours.
2. Choose `sync_scope=derived` and `recover_missing_parts=true` to restore
   additional category tables. Set `derived_tables` to a comma-separated list
   of tables from `DERIVED_TABLES` in `lib/db/derivedtables/setup-derived-tables.ts`.
   The full-catalog run also uploads the refreshed Ethernet page/API table.

The workflow verifies every expected stocked Ethernet controller in the API and
refreshes HTML/JSON and package-filter caches. It checks for W5500 and an ENC28J60
variant before declaring success. No worker code deployment is needed for the
already-published category.

For a local preparation:

```sh
bun scripts/setup-7z.ts
bun scripts/download-cache-fragments.ts
.bin/7zz x .buildtmp/cache.zip -y
bun scripts/download-recovery-cache.ts
.bin/7zz x .recovery/cache.zip -o.buildtmp/recovery -y
RECOVERY_DB_PATH=.buildtmp/recovery/cache.sqlite3 \
  INCLUDE_COMPONENT_CATALOG=1 INCLUDE_STOCK_SNAPSHOT=1 \
  DERIVED_TABLES_LIST=ethernet_controller \
  bun scripts/build-derived-sync-db.ts
bun scripts/refresh-ethernet-controllers.ts
```

The recovery archive adds approximately 680 MB compressed and 5.94 GB extracted
while preparing the database. Archives can be cached; extracted sources are
removed after preparation. Set `recover_missing_parts=false` to stop using the
fallback once the upstream catalog is confirmed complete. This opt-out can
remove restored records if the upstream is still incomplete.

Upstream diagnosis: https://github.com/yaqwsx/jlcparts/issues/159
Preventive upstream fix: https://github.com/yaqwsx/jlcparts/pull/165
