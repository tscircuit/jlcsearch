# Extended promotional parts

`is_extended_promotional` identifies preferred Extended JLC parts receiving basic-part assembly treatment in the latest synchronized source. It is independent of permanent `is_basic` and is not a guarantee of future pricing or availability.

The source predicate is `preferred = 1 AND library_type = 'expand'`. The upstream [JLC normalizer](https://github.com/yaqwsx/jlcparts/blob/master/jlcparts/jlcpcb.py) maps Extended to expand. Missing preferred data, null or unknown library classification, and absent parts in the daily snapshot yield false. Existing stock-only snapshots preserve the last known status.

## API and pages

All 50 component routes in `ROUTE_TO_TABLE` return a JSON boolean and accept `is_extended_promotional=true` / `1` or `false` / `0`. The same applies to `/api/search`, `/components/list`, and special lists for ARM processors, RISC-V processors, analog switches, microphones, LCD drivers and TFT display drivers, including their existing JSON aliases. Omission leaves existing membership, ordering and limits unchanged. Filters combine with existing category-specific filters before the result limit. Invalid flag values are ignored, matching the existing boolean-filter convention.

List pages expose an Extended Promotional column and an All/Yes/No control that represents both positive and negative filters. Categories and footprint-index lists are aggregate resources, not component records, and are unchanged.

Examples:
- `/resistors/list?package=0402&is_extended_promotional=true`
- `/api/search?q=driver&is_extended_promotional=false`

## Category compatibility and cost

Category tables keep their existing physical schemas. Their API reads this temporary status from the current `component_catalog` using its unique LCSC index. A missing catalog row yields false without dropping the category record. Consequently a daily catalog status change reaches all category endpoints without a category rebuild or 50 extra per-table update passes. Existing stock/basic/preferred category fields retain their existing refresh behavior; this change does not redefine them.

Positive generic-category filters use an inner join with qualified category columns, avoiding duplicate status lookups. Unfiltered and negative queries retain scalar lookup semantics so missing catalog records remain visible. Existing category filters and ordering remain intact, but a rare or unmatched promotion filter can still examine many candidates.

This is a consistency and migration-surface tradeoff, not a universal performance improvement. In a local 100,000-row fixture, the positive join improved a 0.1%-match query from 66.07 to 32.49 ms and a no-match query from 48.95 to 26.04 ms; it also improved fully matched and package-selective cases. Both plans used the category package/stock and catalog LCSC indexes. These warm SQLite medians are not production D1 benchmarks, and the join does not eliminate the rare-query candidate-read cost.

## Database lifecycle and rollout

Apply migration `0010_is_extended_promotional.sql` to an already bootstrapped catalog/index before deploying the worker or running updated status batches. It adds and backfills the two central columns and creates status/stock indexes. It never requires the deliberately removed legacy `components` table, and it does not migrate any category table.

Backfill trusts legacy `basic=0 AND preferred=1`. Older builders collapsed null or unknown library classifications into basic=0 without retaining the raw value in catalog metadata. Migration cannot recover that lost distinction. Run a current source stock/status snapshot promptly after migration to restore strict classification and current availability.

The migration performs whole-table updates and index creation. Validate its runtime on a production-sized copy before remote rollout; local fixtures establish correctness, not Cloudflare execution limits. This is a normal one-time migration, not an idempotent repair script or fresh-database bootstrap.

Full catalog builds, exported schemas, and direct/batched search-index rebuilds preserve status. The scheduled stock sync refreshes status even at unchanged stock; repeated identical batches make no additional changes. Existing caching still applies.

## Verification

Run `bun test tests` and `bunx tsc --noEmit` at the root. In `cf-proxy`, run `bun run test --exclude test/contracts.test.ts --maxWorkers=2 --minWorkers=1` and `bunx tsc --noEmit`. The excluded contract suite calls the public deployment, not this unpublished patch.

Coverage includes all 50 real category schemas, special membership predicates, filters before LIMIT 100, local D1 query plans, rendered controls, actual migration and rebuild SQL, and status transitions at constant stock.
