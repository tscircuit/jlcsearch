# BOM inventory freshness

Exact numeric or C-prefixed `/api/search?q=C7519` requests enroll that part in
`_jlcsearch_requested_parts`. This includes empty searches. The hourly live
inventory workflow refreshes recently requested parts **before** the category
crawl, using JLCPCB's exact part-number website lookup. Requests remain active
for 30 days. No per-project allowlist is needed.

The refresh processes the oldest attempts first (up to 300 IDs and about ten
minutes per run). It batches D1 updates and shares the production sync concurrency
group with catalog imports. Failed lookups retain their previous verification
time, record an error, and fail the workflow after processing the other parts.
The workflow uploads its per-part report for inspection. Monitor failures and
backlog as demand grows; the bounded queue is not a guarantee of hourly coverage
under an unlimited request rate.

Verified exact results survive nightly catalog replacements, including metadata
for parts absent from the upstream snapshot. Stock also updates every existing
category table through the normal stock-sync policy. Exact API responses bypass
cached empty results and preserve `stock: null` for unknown data and `stock: 0`
for a confirmed zero. Verified exact stock expires after six hours without a
successful refresh. The response includes `stock_checked_at` when available.
Broad text searches continue filtering for positive stock.

A first lookup enrolls a new part; it does not synchronously call JLCPCB. Until
the next successful scheduled refresh it returns existing catalog stock, or an
empty result if no metadata exists. The availability caller must distinguish
unknown stock from confirmed zero. Existing saved circuit warnings require a
rebuild after the inventory data is corrected.

## Deploy and audit a BOM

Apply D1 migrations before deploying the Worker. Merge the workflow changes so
scheduled refreshes use the same code. A one-time BOM backfill uses a JSON array
of distinct IDs, e.g. `["C7519","C11702"]`:

```sh
REQUESTED_PARTS_FILE=/path/to/parts.json \
REQUESTED_STOCK_REPORT_PATH=/path/to/report.json \
  bun scripts/refresh-requested-stock.ts
```

This explicitly requeues the supplied parts. Compare every unique BOM ID against
`/api/search?q=<id>&limit=1`, preserving the mapping to all reference designators.
Do not infer zero from an empty JLCPCB response, an HTTP error, or a timeout.
