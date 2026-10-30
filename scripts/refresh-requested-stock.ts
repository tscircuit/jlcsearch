import { remoteExecute, type Execute } from "./crawl-live-stock"
import {
  STOCK_SYNC_TARGETS_QUERY,
  stockSyncTargetsFromSchema,
  type StockSyncTarget,
} from "./generate-stock-sync-sql"
import {
  sqlString,
  effectiveStockSql,
  liveObservationUpsertSql,
  type LiveStockRow,
} from "./live-stock-policy"
import { exactLcsc, fetchExactStock } from "../cf-proxy/src/requested-stock"

// Refresh demanded parts before spending the crawl budget on broad categories.
// Old requests age out; failed requests move to the back of the retry queue.
export const REQUESTED_STOCK_QUERY = `SELECT lcsc FROM _jlcsearch_requested_parts
  WHERE requested_at >= unixepoch() - 30 * 86400
    AND attempted_at < unixepoch() - 3600
  ORDER BY attempted_at, requested_at DESC LIMIT 300;`

// No shared staging table: a manual BOM backfill cannot clobber the broad
// crawler's in-flight batch. Each UPDATE reads the newest live observation.
export function requestedStockUpdates(
  rows: LiveStockRow[],
  targets: StockSyncTarget[],
) {
  if (!rows.length) return ""
  const ids = rows
    .map((row) => {
      if (
        exactLcsc(String(row.lcsc)) === null ||
        !Number.isSafeInteger(row.stock) ||
        row.stock! < 0
      )
        throw new Error("Invalid requested stock observation")
      return row.lcsc
    })
    .join(",")
  const stock = effectiveStockSql("target.lcsc", "NULL")
  return [
    liveObservationUpsertSql(rows),
    ...targets.map((target) => {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(target.name))
        throw new Error("Invalid stock table")
      return `UPDATE "${target.name}" AS target SET stock=${stock}
      ${target.has_in_stock ? `, in_stock=CASE WHEN (${stock}) > 0 THEN 1 ELSE 0 END` : ""}
      WHERE lcsc IN (${ids});`
    }),
  ].join("\n")
}

export async function refreshRequestedStock({
  execute,
  targets,
  fetcher = fetch,
  now = () => Math.floor(Date.now() / 1000),
  pause = () => Bun.sleep(500),
}: {
  execute: Execute
  targets: StockSyncTarget[]
  fetcher?: typeof fetch
  now?: () => number
  pause?: () => Promise<unknown>
}) {
  const requests: { lcsc: number }[] = await execute(REQUESTED_STOCK_QUERY)
  const report: { lcsc: number; stock?: number; error?: string }[] = []
  const deadline = Date.now() + 10 * 60_000
  for (
    let offset = 0;
    offset < requests.length && Date.now() < deadline;
    offset += 10
  ) {
    const batch = requests.slice(offset, offset + 10)
    await execute(`UPDATE _jlcsearch_requested_parts SET attempted_at=${now()}
      WHERE lcsc IN (${batch.map((r) => r.lcsc).join(",")});`)
    const observations: {
      lcsc: number
      stock: number
      stock_checked_at: number
    }[] = []
    const updates: string[] = []
    for (const { lcsc } of batch) {
      try {
        const component = await fetchExactStock(lcsc, fetcher)
        const checkedAt = now()
        observations.push({
          lcsc,
          stock: component.stock,
          stock_checked_at: checkedAt,
        })
        // Separate metadata survives nightly catalog replacement and works
        // even for parts absent from the upstream catalog.
        updates.push(`UPDATE _jlcsearch_requested_parts SET verified_at=${checkedAt},
          component_json=${sqlString(JSON.stringify(component))}, last_error=NULL WHERE lcsc=${lcsc};`)
        report.push({ lcsc, stock: component.stock })
      } catch (error) {
        const message = String(error).slice(0, 500)
        updates.push(
          `UPDATE _jlcsearch_requested_parts SET last_error=${sqlString(message)} WHERE lcsc=${lcsc};`,
        )
        report.push({ lcsc, error: message })
      }
      await pause()
    }
    // Database write errors must fail the run, not masquerade as an upstream
    // lookup failure. Stock updates use the existing all-category sync policy.
    await execute(`${observations.length ? requestedStockUpdates(observations, targets) : ""}
      ${updates.join("\n")}`)
  }
  return report
}

if (import.meta.main) {
  // Optional JSON array of C-prefixed IDs for a BOM audit/backfill. All later
  // API requests register automatically; no project-specific list is required.
  if (process.env.REQUESTED_PARTS_FILE) {
    const input: unknown = await Bun.file(
      process.env.REQUESTED_PARTS_FILE,
    ).json()
    if (
      !Array.isArray(input) ||
      !input.length ||
      input.length > 300 ||
      input.some((id) => typeof id !== "string" || exactLcsc(id) === null)
    )
      throw new Error("Expected 1–300 valid LCSC part numbers")
    const ids = [...new Set(input.map((id) => exactLcsc(id)!))]
    await remoteExecute(`INSERT INTO _jlcsearch_requested_parts (lcsc,requested_at)
      VALUES ${ids.map((id) => `(${id},unixepoch())`).join(",")}
      ON CONFLICT(lcsc) DO UPDATE SET requested_at=excluded.requested_at, attempted_at=0;`)
  }
  const targets = stockSyncTargetsFromSchema(
    await remoteExecute(STOCK_SYNC_TARGETS_QUERY),
  )
  const report = await refreshRequestedStock({
    execute: remoteExecute,
    targets,
  })
  await Bun.write(
    process.env.REQUESTED_STOCK_REPORT_PATH || "requested-stock-report.json",
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify(report, null, 2))
  if (report.some((row) => row.error))
    throw new Error(
      "Requested inventory refresh incomplete; see coverage report",
    )
}
