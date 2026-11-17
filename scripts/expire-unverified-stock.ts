import type { StockSyncTarget } from "./generate-stock-sync-sql"
import { sqlString } from "./live-stock-policy"
import {
  indexedStockCleanupTargets,
  stockCleanupCandidatesSql,
} from "./stock-cleanup-targets"

type Execute = (sql: string) => Promise<any[]>
const PAGE_ROWS = 1000
const CHECKPOINT_PAGES = 10
export const DEFAULT_STOCK_CLEANUP_MAX_PAGES = 5

// LIMIT applies to catalog candidates, not the number of missing observations.
// Even a page with no matches advances the cursor and consumes the page budget.
export const unverifiedStockPageSql = (table: string, after: number) => {
  return `SELECT c.lcsc, c.stock,
    EXISTS(SELECT 1 FROM _jlcsearch_live_stock AS o WHERE o.lcsc=c.lcsc) AS verified
    FROM (${stockCleanupCandidatesSql(table, after)}) AS c ORDER BY c.lcsc;`
}

export async function expireUnverifiedStock(
  execute: Execute,
  targets: StockSyncTarget[],
  maxPages = DEFAULT_STOCK_CLEANUP_MAX_PAGES,
  pause: () => Promise<unknown> = () => Bun.sleep(1000),
) {
  if (!Number.isSafeInteger(maxPages) || maxPages < 0 || maxPages > 1000)
    throw new Error("Invalid stock cleanup page budget")
  if (!maxPages) return 0
  for (const target of targets) unverifiedStockPageSql(target.name, 0)
  const [{ enforce }] = await execute(
    "SELECT unixepoch() >= grace_until AS enforce FROM _jlcsearch_stock_policy WHERE id=1;",
  )
  if (!enforce) return 0
  // The same verified target set is used for candidate reads AND stock writes.
  const eligible = await indexedStockCleanupTargets(execute, targets)
  if (!eligible.length) return 0

  const progress = new Map<
    string,
    { after_lcsc: number; completed_at: number }
  >(
    (await execute("SELECT * FROM _jlcsearch_stock_cleanup_progress;")).map(
      (row) => [row.target, row],
    ),
  )
  // Completed tables go behind unfinished ones, so a large catalog cannot
  // permanently starve derived tables when a run exhausts its page budget.
  const ordered = [...eligible].sort(
    (a, b) =>
      (progress.get(a.name)?.completed_at ?? 0) -
        (progress.get(b.name)?.completed_at ?? 0) ||
      a.name.localeCompare(b.name),
  )
  let pages = 0
  let expired = 0
  for (const target of ordered) {
    let after = progress.get(target.name)?.after_lcsc ?? 0
    let pagesSinceCheckpoint = 0
    while (pages < maxPages) {
      const rows: Array<{
        lcsc: number
        stock: number | null
        verified: number
      }> = await execute(unverifiedStockPageSql(target.name, after))
      let previous = after
      for (const row of rows) {
        if (!Number.isSafeInteger(row.lcsc) || row.lcsc <= previous)
          throw new Error(`Invalid or unordered cleanup LCSC in ${target.name}`)
        previous = row.lcsc
      }
      pages++
      pagesSinceCheckpoint++
      const missing = rows.filter((row) => row.stock !== null && !row.verified)
      const done = rows.length < PAGE_ROWS
      after = done ? 0 : rows[rows.length - 1].lcsc
      const updates = missing.length
        ? eligible.map(
            (
              table,
            ) => `UPDATE "${table.name}" AS t SET stock=NULL${table.has_in_stock ? ", in_stock=0" : ""}
              WHERE lcsc IN (${missing.map((row) => row.lcsc).join(",")})
              AND stock IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM _jlcsearch_live_stock AS o WHERE o.lcsc=t.lcsc);`,
          )
        : []
      // Recheck observations in each UPDATE: an exact-part refresh can run
      // between candidate selection and cleanup. Never replace its fresh stock.
      // Checkpoint only every ten pages, on table completion or at the run limit.
      // After interruption, replaying unsaved pages is safe: writes are guarded
      // and repeatable. Never advance progress before every update succeeds.
      // At most four 1,000-ID updates per query request (below 100 KB even
      // for 16-digit IDs). Pace batches when many published tables need edits.
      for (let offset = 0; offset < updates.length; offset += 4) {
        await execute(updates.slice(offset, offset + 4).join("\n"))
        if (offset + 4 < updates.length) await pause()
      }
      if (
        pagesSinceCheckpoint >= CHECKPOINT_PAGES ||
        done ||
        pages >= maxPages
      ) {
        await execute(`INSERT INTO _jlcsearch_stock_cleanup_progress(target,after_lcsc,completed_at)
        VALUES (${sqlString(target.name)},${after},${done ? "unixepoch()" : "0"})
        ON CONFLICT(target) DO UPDATE SET after_lcsc=excluded.after_lcsc,
          completed_at=${done ? "excluded.completed_at" : "_jlcsearch_stock_cleanup_progress.completed_at"};`)
        pagesSinceCheckpoint = 0
      }
      expired += missing.length
      await pause()
      if (done) break
    }
    if (pages >= maxPages) break
  }
  return expired
}
