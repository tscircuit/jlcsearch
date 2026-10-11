# Live inventory synchronization

The upstream jlcparts archive remains our metadata source. Its publication
time is not proof that each quantity was refreshed. Live inventory comes
directly from JLCPCB's website category API and is stored independently in D1.

## Rotation and coverage

`Refresh live inventory` runs hourly at minute 23, sharing the
`production-d1-sync` lock with catalog imports. It defaults to 1,000 pages per
run (up to 100,000 observations) and 1,000 pages per category visit. It finishes
an ongoing scan before starting the oldest attempted/completed category. Large categories save their page
cursor and continue on a later visit; a failed category cannot starve others.
Website category names are resolved from exact LCSC matches and saved separately
from the catalog taxonomy. Requests are serial with a 250 ms delay between
pages and a 30 second timeout.

The initial goal is a complete sweep every 24–48 hours. This is a target,
not a guarantee: website categories include parts outside our catalog, and
request failures, changing page order, changing totals, and queued runs reduce
throughput. Each run publishes a `live-stock-coverage` artifact and Actions
summary with counts checked within 24 hours, 48 hours, and the freshness limit.
Use these measurements to adjust the workflow's `max_pages` and
`pages_per_category` inputs rather than inferring coverage from job success.

## Stock precedence and expiration

`_jlcsearch_live_stock` records the quantity and its actual verification time.
Its contents survive full catalog replacements. Every production metadata
import batch and stock-only batch applies these observations before publishing
its quantities. An older observation cannot replace a newer one. Explicit
zero is out of stock; missing or expired stock is NULL (unknown).

The default verification lifetime is 72 hours. Scheduling delays or an
expiration backlog can delay enforcement; the coverage report exposes how
many catalog observations are still within the limit. The hourly workflow expires
up to 100,000 observations per run, updating availability across every deployed
stock table. Imports also enforce expiration immediately for their affected
parts. Successful refreshes make expired parts known again.

The migration starts a seven-day rollout window. During that window only,
parts without any live observation may retain upstream snapshot quantities.
Afterward, imports publish unknown for unverified parts. The hourly job also
clears up to 100,000 unverified legacy rows, including parts that survive only
in derived tables or disappear from newer snapshots. This can reduce
available search results if crawler coverage is inadequate; monitor coverage
before the window ends. To extend the initial window explicitly:

```sql
UPDATE _jlcsearch_stock_policy SET grace_until = unixepoch() + 86400 WHERE id = 1;
```

Extending the window retains unverified snapshot quantities; it does not
make them current. Never update `checked_at` to an import or deployment time.

## Response validation and recovery

Each page must have valid, nonnegative integer quantities, exact LCSC codes,
the requested subcategory, and the expected page length. Malformed responses
do not change stock. A changed total invalidates completeness but retains the cursor, so later
pages still get refreshed. A complete
scan must contain the advertised number of distinct parts before previously
known missing parts are marked unknown. Partial scans still update the parts
they successfully observed, but do not infer absence.

A failed run is safe to rerun. Observation writes and stock corrections are
idempotent; progress advances only after its stock batch is applied. A lost
response can repeat a page without making an incomplete category complete.

The client response cache lasts five minutes, and KV entries are fresh for
15 minutes with at most one hour of stale fallback. The Worker must be
deployed for these new cache limits to take effect; existing browser caches
can retain their previous lifetime until they expire.

For a read-only endpoint probe with no Cloudflare credentials:

```sh
bun scripts/crawl-live-stock.ts --probe
```

The PR workflow runs this probe without production secrets. To run a bounded
production refresh after merge, dispatch `Refresh live inventory` with a
smaller `max_pages`, then inspect its coverage artifact. Keep the production
lock for every writer; the staging table is shared across stock updates.
