import { randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  STOCK_SYNC_TARGETS_QUERY,
  type StockSyncTarget,
  createStockSyncBatchSql,
  stockSyncTargetsFromSchema,
} from "./generate-stock-sync-sql"
import { type LiveStockRow, sqlString } from "./live-stock-policy"

const ENDPOINT =
  "https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList/v2"
export interface StockCategory {
  category: string
  subcategory: string
  next_page: number
  cycle: string
  expected_total: number | null
  consistent?: number
  web_category?: string | null
  web_subcategory?: string | null
}
export type Execute = (sql: string) => Promise<any[]>

export async function resolveStockCategory(
  c: StockCategory,
  execute: Execute,
  fetcher: typeof fetch = fetch,
): Promise<StockCategory> {
  if (c.web_category && c.web_subcategory) return c
  const samples: Array<{ lcsc: number }> =
    await execute(`SELECT lcsc FROM component_catalog
    WHERE category=${sqlString(c.category)} AND subcategory=${sqlString(c.subcategory)} ORDER BY stock DESC LIMIT 5;`)
  for (const sample of samples) {
    const response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        currentPage: 1,
        pageSize: 25,
        keyword: `C${sample.lcsc}`,
        searchSource: "search",
        searchType: 2,
        componentBrandList: [],
        componentSpecificationList: [],
        componentAttributeList: [],
        paramList: [],
      }),
    })
    if (!response.ok) throw new Error(`JLCPCB taxonomy HTTP ${response.status}`)
    const body: any = await response.json()
    if (body.code !== 200 || !Array.isArray(body.data?.componentPageInfo?.list))
      throw new Error("Invalid JLCPCB taxonomy response")
    const row = body.data.componentPageInfo.list.find(
      (row: any) => row.componentCode === `C${sample.lcsc}`,
    )
    if (!row) continue
    // Website response fields reverse the order of the request fields.
    if (
      typeof row.secondSortName !== "string" ||
      !row.secondSortName.trim() ||
      typeof row.firstSortName !== "string" ||
      !row.firstSortName.trim() ||
      row.firstSortName !== row.componentTypeEn
    )
      throw new Error("Invalid JLCPCB category mapping")
    return {
      ...c,
      web_category: row.secondSortName,
      web_subcategory: row.firstSortName,
    }
  }
  throw new Error(
    `Could not resolve website category for ${c.category}/${c.subcategory}`,
  )
}

export async function fetchStockPage(
  category: string,
  subcategory: string,
  page: number,
  fetcher: typeof fetch = fetch,
) {
  if (
    !category.trim() ||
    !subcategory.trim() ||
    !Number.isSafeInteger(page) ||
    page < 1
  )
    throw new Error("Invalid stock category or page")
  const response = await fetcher(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      currentPage: page,
      pageSize: 100,
      keyword: "",
      firstSortName: category,
      secondSortName: subcategory,
      searchSource: "search",
      searchType: 2,
      componentBrandList: [],
      componentSpecificationList: [],
      componentAttributeList: [],
      paramList: [],
    }),
  })
  if (!response.ok) throw new Error(`JLCPCB HTTP ${response.status}`)
  const body: any = await response.json()
  const info = body.data?.componentPageInfo
  if (
    body.code !== 200 ||
    !Number.isSafeInteger(info?.total) ||
    info.total <= 0 ||
    !Array.isArray(info.list) ||
    info.list.length > 100
  )
    throw new Error(
      `Incomplete JLCPCB stock page for ${category}/${subcategory}: code=${body.code}, total=${info?.total}, rows=${info?.list?.length}`,
    )
  // Check the raw page size before removing duplicate or malformed rows.
  const expectedLength = Math.max(
    0,
    Math.min(100, info.total - (page - 1) * 100),
  )
  if (info.list.length !== expectedLength)
    throw new Error("Incomplete JLCPCB pagination")
  const distinct = new Map<number, LiveStockRow>()
  let duplicateRows = 0
  let rejectedRows = 0
  for (const product of info.list) {
    const code = product?.componentCode
    const lcsc =
      typeof code === "string" && /^C[1-9]\d*$/.test(code)
        ? Number(code.slice(1))
        : NaN
    if (
      product?.componentTypeEn !== subcategory ||
      !Number.isSafeInteger(lcsc) ||
      !Number.isSafeInteger(product.stockCount) ||
      product.stockCount < 0
    ) {
      rejectedRows++
      continue
    }
    if (distinct.has(lcsc)) duplicateRows++
    // Keep the last validated quantity, as with duplicates across pages.
    distinct.set(lcsc, { lcsc, stock: product.stockCount })
  }
  if (info.list.length && !distinct.size)
    throw new Error(
      `No valid live stock rows for ${category}/${subcategory} page ${page}: rejected=${rejectedRows}`,
    )
  return {
    total: info.total as number,
    rows: [...distinct.values()],
    duplicateRows,
    rejectedRows,
  }
}

const predicate = (c: StockCategory) =>
  `category=${sqlString(c.category)} AND subcategory=${sqlString(c.subcategory)}`

export const CATEGORY_CRAWL_QUERY = `SELECT c.category, c.subcategory,
  COALESCE(p.next_page, 1) AS next_page, COALESCE(p.cycle, '') AS cycle,
  p.expected_total, COALESCE(p.consistent, 1) AS consistent, p.web_category, p.web_subcategory
FROM (SELECT DISTINCT category, subcategory FROM component_catalog
  WHERE category IS NOT NULL AND category != '' AND subcategory IS NOT NULL AND subcategory != '') AS c
LEFT JOIN _jlcsearch_stock_categories AS p
  ON p.category=c.category AND p.subcategory=c.subcategory
ORDER BY CASE WHEN COALESCE(p.cycle, '') != '' THEN 0 ELSE 1 END,
  MAX(COALESCE(p.completed_at, 0), COALESCE(p.attempted_at, 0)), c.category, c.subcategory;`

export async function crawlCategory({
  category: c,
  execute,
  targets,
  maxPages,
  fetcher = fetch,
  now = () => Math.floor(Date.now() / 1000),
}: {
  category: StockCategory
  execute: Execute
  targets: StockSyncTarget[]
  maxPages: number
  fetcher?: typeof fetch
  now?: () => number
}) {
  if (!Number.isSafeInteger(maxPages) || maxPages < 1)
    throw new Error("Invalid page budget")
  let page = c.next_page
  const cycle = c.cycle || randomUUID()
  let total = c.expected_total
  let consistent = c.consistent ?? 1
  let pages = 0
  let checked = 0
  let duplicateRows = 0
  let rejectedRows = 0
  let complete = false
  let batch: LiveStockRow[] = []
  const flush = async () => {
    if (!batch.length) return
    // Page order can change while the total stays constant. Apply the last
    // valid quantity once, then let the distinct-count check reject coverage.
    const distinct = [...new Map(batch.map((row) => [row.lcsc, row])).values()]
    await execute(`${createStockSyncBatchSql(distinct, targets, true)}
      INSERT INTO _jlcsearch_stock_categories
        (category, subcategory, next_page, cycle, expected_total, attempted_at, consistent, web_category, web_subcategory)
      VALUES (${sqlString(c.category)},${sqlString(c.subcategory)},${page},${sqlString(cycle)},${total},${now()},${consistent},${sqlString(c.web_category)},${sqlString(c.web_subcategory)})
      ON CONFLICT(category, subcategory) DO UPDATE SET
        next_page=excluded.next_page, cycle=excluded.cycle,
        expected_total=excluded.expected_total, attempted_at=excluded.attempted_at, consistent=excluded.consistent,
        web_category=excluded.web_category, web_subcategory=excluded.web_subcategory;`)
    batch = []
  }
  while (pages < maxPages) {
    const result = await fetchStockPage(
      c.web_category || c.category,
      c.web_subcategory || c.subcategory,
      page,
      fetcher,
    )
    pages++
    duplicateRows += result.duplicateRows
    rejectedRows += result.rejectedRows
    // Valid observations still refresh stock, but a damaged page cannot
    // prove that parts absent from this pass have disappeared upstream.
    if (result.duplicateRows || result.rejectedRows) {
      consistent = 0
      console.warn(
        `${c.category}/${c.subcategory} page ${page}: duplicates=${result.duplicateRows}, rejected=${result.rejectedRows}`,
      )
    }
    // Keep making progress through a changing category. Restarting on each
    // change would permanently strand the later pages of large categories.
    // Such a pass can update observations but cannot infer missing parts.
    if (total !== null && total !== result.total) consistent = 0
    total = result.total
    const checkedAt = now()
    batch.push(
      ...result.rows.map((row) => ({
        ...row,
        stock_checked_at: checkedAt,
        category: c.category,
        subcategory: c.subcategory,
        seen_cycle: cycle,
      })),
    )
    checked += result.rows.length
    page++
    complete = (page - 1) * 100 >= total
    if (batch.length >= 1000 || complete) await flush()
    if (complete) break
    await Bun.sleep(250)
  }
  await flush()
  if (complete) {
    const [{ count }] = await execute(
      `SELECT COUNT(*) AS count FROM _jlcsearch_live_stock WHERE ${predicate(c)} AND seen_cycle=${sqlString(cycle)};`,
    )
    if (count !== total || !consistent) {
      await execute(
        `UPDATE _jlcsearch_stock_categories SET next_page=1, cycle='', expected_total=NULL, consistent=1 WHERE ${predicate(c)};`,
      )
      return {
        pages,
        checked,
        duplicateRows,
        rejectedRows,
        complete: false,
        restarted: true,
      }
    }
    // Only a complete, duplicate-free scan can establish missing parts. Keep
    // their metadata and publish unknown rather than inventing zero stock.
    while (true) {
      const missing: { lcsc: number }[] = await execute(`SELECT lcsc FROM (
        SELECT lcsc FROM component_catalog WHERE ${predicate(c)}
        UNION SELECT lcsc FROM _jlcsearch_live_stock WHERE ${predicate(c)}
      ) AS known WHERE NOT EXISTS (SELECT 1 FROM _jlcsearch_live_stock AS o
        WHERE o.lcsc=known.lcsc AND o.seen_cycle=${sqlString(cycle)}) LIMIT 1000;`)
      if (!missing.length) break
      await execute(
        createStockSyncBatchSql(
          missing.map((row) => ({
            ...row,
            stock: null,
            stock_checked_at: now(),
            category: c.category,
            subcategory: c.subcategory,
            seen_cycle: cycle,
          })),
          targets,
          true,
        ),
      )
    }
    await execute(`UPDATE _jlcsearch_stock_categories SET next_page=1, cycle='', expected_total=NULL,
      consistent=1, completed_at=${now()} WHERE ${predicate(c)};`)
  }
  return {
    pages,
    checked,
    duplicateRows,
    rejectedRows,
    complete,
    restarted: false,
  }
}

export async function expireLiveStock(
  execute: Execute,
  targets: StockSyncTarget[],
  maxBatches = 100,
) {
  let expired = 0
  for (let i = 0; i < maxBatches; i++) {
    const rows: { lcsc: number }[] =
      await execute(`SELECT lcsc FROM _jlcsearch_live_stock
      WHERE expired=0 AND checked_at < unixepoch() - (SELECT max_age_seconds FROM _jlcsearch_stock_policy WHERE id=1)
      ORDER BY checked_at, lcsc LIMIT 1000;`)
    if (!rows.length) break
    await execute(`${createStockSyncBatchSql(
      rows.map((row) => ({ ...row, stock: null })),
      targets,
      true,
    )}
      UPDATE _jlcsearch_live_stock SET expired=1 WHERE lcsc IN (${rows.map((row) => row.lcsc).join(",")});`)
    expired += rows.length
  }
  return expired
}

export async function expireUnverifiedStock(
  execute: Execute,
  targets: StockSyncTarget[],
  maxBatches = 100,
) {
  const [{ enforce }] = await execute(
    "SELECT unixepoch() >= grace_until AS enforce FROM _jlcsearch_stock_policy WHERE id=1;",
  )
  if (!enforce) return 0
  let batches = 0
  let expired = 0
  // Include rows retained in derived tables or omitted from a new snapshot.
  // Clearing one LCSC number corrects every table, so it cannot be selected
  // repeatedly. The normal nightly import handles most of this work in bulk.
  for (const target of targets) {
    while (batches < maxBatches) {
      const rows: Array<{ lcsc: number }> =
        await execute(`SELECT lcsc FROM "${target.name}" AS t
        WHERE stock IS NOT NULL AND NOT EXISTS (SELECT 1 FROM _jlcsearch_live_stock AS o WHERE o.lcsc=t.lcsc) LIMIT 1000;`)
      if (!rows.length) break
      await execute(
        createStockSyncBatchSql(
          rows.map((row) => ({ ...row, stock: null })),
          targets,
          true,
        ),
      )
      expired += rows.length
      batches++
    }
    if (batches >= maxBatches) break
  }
  return expired
}

export const STOCK_COVERAGE_QUERY = `SELECT
  COUNT(*) AS catalog_parts,
  COUNT(o.lcsc) AS ever_checked,
  COUNT(CASE WHEN o.checked_at >= unixepoch() - 86400 THEN 1 END) AS checked_within_24h,
  COUNT(CASE WHEN o.checked_at >= unixepoch() - 172800 THEN 1 END) AS checked_within_48h,
  COUNT(CASE WHEN o.checked_at >= unixepoch() - p.max_age_seconds THEN 1 END) AS within_freshness_limit,
  p.grace_until, p.max_age_seconds
FROM component_catalog AS c LEFT JOIN _jlcsearch_live_stock AS o ON o.lcsc=c.lcsc
CROSS JOIN _jlcsearch_stock_policy AS p WHERE p.id=1;`

async function remoteExecute(sql: string): Promise<any[]> {
  const cfDirectory = path.resolve(import.meta.dir, "../cf-proxy")
  if (/^\s*SELECT\b/i.test(sql)) {
    const child = Bun.spawn(
      [
        "bash",
        "scripts/retry-command.sh",
        "bunx",
        "wrangler",
        "d1",
        "execute",
        process.env.DB_NAME || "jlcsearch",
        "--remote",
        "--json",
        "--command",
        sql,
      ],
      { cwd: cfDirectory, stdout: "pipe", stderr: "inherit" },
    )
    const output = await new Response(child.stdout).text()
    if ((await child.exited) !== 0) throw new Error("D1 stock query failed")
    const results = JSON.parse(output)
    if (
      !Array.isArray(results) ||
      results.length !== 1 ||
      results[0].success !== true ||
      !Array.isArray(results[0].results)
    )
      throw new Error("Invalid D1 stock response")
    return results[0].results
  }
  const directory = await mkdtemp(path.join(tmpdir(), "jlcsearch-live-stock-"))
  const filename = path.join(directory, "command.sql")
  try {
    await Bun.write(filename, sql)
    const child = Bun.spawn(
      [
        "bash",
        "scripts/retry-command.sh",
        "bunx",
        "wrangler",
        "d1",
        "execute",
        process.env.DB_NAME || "jlcsearch",
        "--remote",
        "--json",
        "--file",
        filename,
      ],
      { cwd: cfDirectory, stdout: "pipe", stderr: "inherit" },
    )
    const output = await new Response(child.stdout).text()
    if ((await child.exited) !== 0) throw new Error("D1 stock command failed")
    return []
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function main() {
  if (process.argv.includes("--preview")) {
    // Production reads only: use its actual taxonomy to validate broad API
    // coverage before enabling the rotating writer or its rollout clock.
    const categories: Array<{
      category: string
      subcategory: string
      parts: number
    }> = await remoteExecute(`SELECT category, subcategory, COUNT(*) AS parts
      FROM component_catalog WHERE category IS NOT NULL AND category != ''
      AND subcategory IS NOT NULL AND subcategory != ''
      GROUP BY category, subcategory ORDER BY COUNT(*) DESC LIMIT 5;`)
    const report = []
    for (const category of categories) {
      console.log(JSON.stringify({ preview_category: category }))
      try {
        const resolved = await resolveStockCategory(
          { ...category, next_page: 1, cycle: "", expected_total: null },
          remoteExecute,
        )
        const page = await fetchStockPage(
          resolved.web_category!,
          resolved.web_subcategory!,
          1,
        )
        const current: Array<{ lcsc: number; stock: number | null }> =
          await remoteExecute(
            `SELECT lcsc, stock FROM component_catalog WHERE lcsc IN (${page.rows.map((row) => row.lcsc).join(",")});`,
          )
        const byCode = new Map(page.rows.map((row) => [row.lcsc, row.stock]))
        report.push({
          ...category,
          web_category: resolved.web_category,
          web_subcategory: resolved.web_subcategory,
          website_parts: page.total,
          compared: current.length,
          mismatched: current.filter(
            (row) => row.stock !== byCode.get(row.lcsc),
          ).length,
          stale_positive: current.filter(
            (row) =>
              row.stock !== null && row.stock > 0 && byCode.get(row.lcsc) === 0,
          ).length,
        })
      } catch (error) {
        report.push({ ...category, error: String(error) })
      }
    }
    console.log(JSON.stringify(report, null, 2))
    await Bun.write(
      process.env.LIVE_STOCK_REPORT_PATH || "live-stock-report.json",
      JSON.stringify(report, null, 2),
    )
    if (report.some((row) => "error" in row))
      throw new Error("Live stock preview found unsupported categories")
    return
  }
  // A production-free probe validates the actual website response in Actions.
  if (process.argv.includes("--probe")) {
    const category = process.env.LIVE_STOCK_CATEGORY || "Switches"
    const subcategory = process.env.LIVE_STOCK_SUBCATEGORY || "Slide Switches"
    const first = await fetchStockPage(category, subcategory, 1)
    console.log(
      JSON.stringify({
        category,
        subcategory,
        total: first.total,
        checked: first.rows.length,
        rows: first.rows,
      }),
    )
    return
  }
  const maxPages = Number(process.env.LIVE_STOCK_MAX_PAGES || 1000)
  const pagesPerCategory = Number(
    process.env.LIVE_STOCK_PAGES_PER_CATEGORY || 1000,
  )
  if (
    ![maxPages, pagesPerCategory].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 2000,
    )
  )
    throw new Error("Invalid live stock crawl budget")
  const targets = stockSyncTargetsFromSchema(
    await remoteExecute(STOCK_SYNC_TARGETS_QUERY),
  )
  if (
    !targets.some((t) => t.name === "component_catalog") ||
    !targets.some((t) => t.name === "search_index")
  )
    throw new Error("Missing required production stock tables")
  const expired = await expireLiveStock(remoteExecute, targets)
  const unverifiedExpired = await expireUnverifiedStock(remoteExecute, targets)
  const categories: StockCategory[] = await remoteExecute(CATEGORY_CRAWL_QUERY)
  let pages = 0
  let checked = 0
  let failures = 0
  let duplicateRows = 0
  let rejectedRows = 0
  for (const category of categories) {
    if (pages >= maxPages) break
    try {
      const result = await crawlCategory({
        category: await resolveStockCategory(category, remoteExecute),
        execute: remoteExecute,
        targets,
        maxPages: Math.min(pagesPerCategory, maxPages - pages),
      })
      pages += result.pages
      checked += result.checked
      duplicateRows += result.duplicateRows
      rejectedRows += result.rejectedRows
      console.log(JSON.stringify({ ...category, ...result }))
    } catch (error) {
      failures++
      // The category may have consumed its full allowance before failing.
      pages += Math.min(pagesPerCategory, maxPages - pages)
      console.error(
        `${category.category}/${category.subcategory}: ${String(error)}`,
      )
      // Retain its cursor but stop prioritizing a failing scan. On resuming,
      // it can update quantities but cannot infer missing parts in this pass.
      await remoteExecute(`INSERT INTO _jlcsearch_stock_categories (category, subcategory, attempted_at)
        VALUES (${sqlString(category.category)},${sqlString(category.subcategory)},unixepoch())
        ON CONFLICT(category, subcategory) DO UPDATE SET attempted_at=excluded.attempted_at, cycle='', consistent=0, web_category=NULL, web_subcategory=NULL;`)
    }
  }
  const coverage = await remoteExecute(STOCK_COVERAGE_QUERY)
  const report = {
    pages,
    checked,
    expired,
    unverifiedExpired,
    failures,
    duplicateRows,
    rejectedRows,
    coverage,
  }
  console.log(JSON.stringify(report, null, 2))
  await Bun.write(
    process.env.LIVE_STOCK_REPORT_PATH || "live-stock-report.json",
    JSON.stringify(report, null, 2),
  )
  if (failures)
    throw new Error(
      `${failures} stock categories failed; completed observations were retained`,
    )
}

if (import.meta.main) await main()
