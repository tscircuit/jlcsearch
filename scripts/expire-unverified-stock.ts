import type { StockSyncTarget } from "./generate-stock-sync-sql"
import { sqlString } from "./live-stock-policy"

type Execute = (sql: string) => Promise<any[]>
const PAGE_ROWS = 1000

// LIMIT applies to catalog candidates, not the number of missing observations.
// Even a page with no matches advances the cursor and consumes the page budget.
export const unverifiedStockPageSql = (table: string, after: number) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table))
    throw new Error("Invalid stock cleanup table")
  if (!Number.isSafeInteger(after) || after < 0)
    throw new Error("Invalid stock cleanup cursor")
  return `SELECT c.lcsc, c.stock,
    EXISTS(SELECT 1 FROM _jlcsearch_live_stock AS o WHERE o.lcsc=c.lcsc) AS verified
    FROM (SELECT lcsc, stock FROM "${table}" WHERE lcsc > ${after}
      ORDER BY lcsc LIMIT ${PAGE_ROWS}) AS c ORDER BY c.lcsc;`
}

export async function expireUnverifiedStock(
  execute: Execute,
  targets: StockSyncTarget[],
  maxPages = 100,
  pause: () => Promise<unknown> = () => Bun.sleep(1000),
) {
  if (!Number.isSafeInteger(maxPages) || maxPages < 0 || maxPages > 1000)
    throw new Error("Invalid stock cleanup page budget")
  for (const target of targets) unverifiedStockPageSql(target.name, 0)
  const [{ enforce }] = await execute(
    "SELECT unixepoch() >= grace_until AS enforce FROM _jlcsearch_stock_policy WHERE id=1;",
  )
  if (!enforce || !maxPages) return 0

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
  const ordered = [...targets].sort(
    (a, b) =>
      (progress.get(a.name)?.completed_at ?? 0) -
        (progress.get(b.name)?.completed_at ?? 0) ||
      a.name.localeCompare(b.name),
  )
  let pages = 0
  let expired = 0
  for (const target of ordered) {
    let after = progress.get(target.name)?.after_lcsc ?? 0
    while (pages < maxPages) {
      const rows: Array<{
        lcsc: number
        stock: number | null
        verified: number
      }> = await execute(unverifiedStockPageSql(target.name, after))
      pages++
      const missing = rows.filter((row) => row.stock !== null && !row.verified)
      const done = rows.length < PAGE_ROWS
      after = done ? 0 : rows[rows.length - 1].lcsc
      const updates = missing.length
        ? targets.map(
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
      // Advance only after all updates succeed; a failed/lost reply is retryable.
      await execute(`${updates.join("\n")}
        INSERT INTO _jlcsearch_stock_cleanup_progress(target,after_lcsc,completed_at)
        VALUES (${sqlString(target.name)},${after},${done ? "unixepoch()" : "0"})
        ON CONFLICT(target) DO UPDATE SET after_lcsc=excluded.after_lcsc,
          completed_at=${done ? "excluded.completed_at" : "_jlcsearch_stock_cleanup_progress.completed_at"};`)
      expired += missing.length
      await pause()
      if (done) break
    }
    if (pages >= maxPages) break
  }
  return expired
}
