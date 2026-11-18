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
import {
  ExactPartNotFoundError,
  exactLcsc,
  fetchExactStock,
} from "../cf-proxy/src/requested-stock"

const REQUESTED_STOCK_LIMIT = 300
const POPULAR_PRIORITY_LIMIT = 200
const POPULAR_PARTS_PER_CATEGORY = 100
const RETRY_COOLDOWN = "attempted_at < unixepoch() - 3600"
const DEMAND_SCORE =
  "(r.demand_score >> MIN(31, MAX(0, unixepoch() / 86400 - r.requested_at / 86400)))"

async function selectRequestedParts(execute: Execute, popularOnly: boolean) {
  // The hourly category job applies migrations independently of this job.
  const [hasPopularity] =
    await execute(`SELECT 1 FROM pragma_table_info('_jlcsearch_requested_parts')
    WHERE name = 'demand_score';`)
  if (popularOnly && !hasPopularity)
    throw new Error("The stock popularity migration must be applied first")

  // Rank before checking the cooldown so a recently refreshed part doesn't
  // expand its category's list. Oldest attempts go first to cover large pools.
  const popular: { lcsc: number }[] = hasPopularity
    ? await execute(`SELECT lcsc FROM (
        SELECT r.lcsc, r.attempted_at,
          ROW_NUMBER() OVER (
            PARTITION BY TRIM(c.category)
            ORDER BY ${DEMAND_SCORE} DESC, r.requested_at DESC, r.lcsc
          ) AS category_rank
        FROM _jlcsearch_requested_parts AS r INDEXED BY idx_requested_parts_recent
        JOIN component_catalog AS c ON c.lcsc = r.lcsc
        WHERE r.requested_at >= unixepoch() - 7 * 86400
          AND ${DEMAND_SCORE} >= 2
          AND TRIM(c.category) <> ''
      )
      WHERE category_rank <= ${POPULAR_PARTS_PER_CATEGORY} AND ${RETRY_COOLDOWN}
      ORDER BY attempted_at, category_rank, lcsc
      LIMIT ${popularOnly ? REQUESTED_STOCK_LIMIT : POPULAR_PRIORITY_LIMIT};`)
    : []
  if (popularOnly) return popular

  // Leave room for newly requested and long-waiting parts in the normal run.
  const exclude = popular.length
    ? `AND lcsc NOT IN (${popular.map(({ lcsc }) => lcsc).join(",")})`
    : ""
  const queued: { lcsc: number }[] =
    await execute(`SELECT lcsc FROM _jlcsearch_requested_parts
    WHERE requested_at >= unixepoch() - 30 * 86400 AND ${RETRY_COOLDOWN}
      ${exclude}
    ORDER BY attempted_at, requested_at DESC, lcsc
    LIMIT ${REQUESTED_STOCK_LIMIT - popular.length};`)
  // Mix both groups so the run's time limit cannot strand the regular queue
  // behind a slow batch of popular parts.
  const requests: { lcsc: number }[] = []
  const groups = Math.max(Math.ceil(popular.length / 2), queued.length)
  for (let i = 0; i < groups; i++) {
    requests.push(...popular.slice(i * 2, i * 2 + 2), ...queued.slice(i, i + 1))
  }
  return requests
}

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
  popularOnly = false,
  requestedIds,
  fetcher = fetch,
  now = () => Math.floor(Date.now() / 1000),
  pause = () => Bun.sleep(500),
}: {
  execute: Execute
  targets: StockSyncTarget[]
  popularOnly?: boolean
  requestedIds?: number[]
  fetcher?: typeof fetch
  now?: () => number
  pause?: () => Promise<unknown>
}) {
  const requests = requestedIds
    ? requestedIds.map((lcsc) => ({ lcsc }))
    : await selectRequestedParts(execute, popularOnly)
  const report: {
    lcsc: number
    stock?: number
    error?: string
    unknown?: boolean
  }[] = []
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
        report.push({
          lcsc,
          error: message,
          ...(error instanceof ExactPartNotFoundError ? { unknown: true } : {}),
        })
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
  let requestedIds: number[] | undefined
  if (process.env.REQUESTED_PARTS_FILE) {
    const input: unknown = await Bun.file(
      process.env.REQUESTED_PARTS_FILE,
    ).json()
    if (
      !Array.isArray(input) ||
      !input.length ||
      input.length > REQUESTED_STOCK_LIMIT ||
      input.some((id) => typeof id !== "string" || exactLcsc(id) === null)
    )
      throw new Error("Expected 1–300 valid LCSC part numbers")
    requestedIds = [...new Set(input.map((id) => exactLcsc(id)!))]
    await remoteExecute(`INSERT INTO _jlcsearch_requested_parts (lcsc,requested_at)
      VALUES ${requestedIds.map((id) => `(${id},unixepoch())`).join(",")}
      ON CONFLICT(lcsc) DO UPDATE SET requested_at=excluded.requested_at, attempted_at=0;`)
  }
  const targets = stockSyncTargetsFromSchema(
    await remoteExecute(STOCK_SYNC_TARGETS_QUERY),
  )
  const report = await refreshRequestedStock({
    execute: remoteExecute,
    targets,
    popularOnly: process.env.REQUESTED_STOCK_POPULAR_ONLY === "true",
    requestedIds,
  })
  await Bun.write(
    process.env.REQUESTED_STOCK_REPORT_PATH || "requested-stock-report.json",
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify(report, null, 2))
  if (report.some((row) => row.error && !row.unknown))
    throw new Error(
      "Requested inventory refresh incomplete; see coverage report",
    )
}
