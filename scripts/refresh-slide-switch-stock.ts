import { Database } from "bun:sqlite"
import { createLiveStockWriter } from "./live-stock-observation"

const ENDPOINT =
  "https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList/v2"

export interface SlideSwitchStock {
  lcsc: number
  stock: number
}

export async function fetchSlideSwitchStock(fetcher: typeof fetch = fetch) {
  const rows = new Map<number, SlideSwitchStock>()
  let total: number | undefined
  for (let page = 1; page <= 100; page++) {
    const response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        currentPage: page,
        pageSize: 100,
        keyword: "",
        firstSortName: "Switches",
        secondSortName: "Slide Switches",
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
      info.list.length === 0
    ) {
      throw new Error("Incomplete JLCPCB slide-switch response")
    }
    total ??= info.total as number
    if (info.total !== total)
      throw new Error("JLCPCB total changed during fetch")
    for (const product of info.list) {
      if (
        product.componentTypeEn !== "Slide Switches" ||
        !/^C[1-9]\d*$/.test(product.componentCode) ||
        !Number.isSafeInteger(Number(product.componentCode.slice(1))) ||
        !Number.isSafeInteger(product.stockCount) ||
        product.stockCount < 0
      ) {
        throw new Error("Invalid slide-switch stock in JLCPCB response")
      }
      const lcsc = Number(product.componentCode.slice(1))
      if (rows.has(lcsc)) throw new Error(`Duplicate slide switch C${lcsc}`)
      rows.set(lcsc, { lcsc, stock: product.stockCount })
    }
    if (rows.size === total) return [...rows.values()]
    if (rows.size > total)
      throw new Error("JLCPCB returned more rows than total")
    await Bun.sleep(250)
  }
  throw new Error("Slide-switch pagination exceeded safety limit")
}

const hasTable = (db: Database, name: string) =>
  Boolean(
    db
      .query("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
      .get(name),
  )

export function mergeSlideSwitchStock(
  db: Database,
  rows: SlideSwitchStock[],
  checkedAt = Math.floor(Date.now() / 1000),
) {
  if (!rows.length || !Number.isSafeInteger(checkedAt) || checkedAt <= 0) {
    throw new Error("Refusing an empty or undated slide-switch stock refresh")
  }
  const seen = new Set<number>()
  for (const row of rows) {
    if (
      !Number.isSafeInteger(row.lcsc) ||
      row.lcsc <= 0 ||
      !Number.isSafeInteger(row.stock) ||
      row.stock < 0 ||
      seen.has(row.lcsc)
    )
      throw new Error("Invalid or duplicate slide-switch stock")
    seen.add(row.lcsc)
  }
  db.transaction(() => {
    const observations = new Map<number, number | null>(
      rows.map((row) => [row.lcsc, row.stock]),
    )
    // A complete category response can establish that a previously known part
    // is missing, but cannot establish a zero quantity for it.
    const stockExists = hasTable(db, "component_stock")
    if (stockExists) {
      const columns = new Set(
        db
          .query<{ name: string }, []>("PRAGMA table_info(component_stock)")
          .all()
          .map((c) => c.name),
      )
      if (columns.has("subcategory")) {
        for (const row of db
          .query<{ lcsc: number }, []>(
            "SELECT lcsc FROM component_stock WHERE subcategory='Slide Switches'",
          )
          .all()) {
          if (!seen.has(row.lcsc)) observations.set(row.lcsc, null)
        }
      }
    }
    const catalogExists = hasTable(db, "component_catalog")
    if (catalogExists) {
      for (const row of db
        .query<{ lcsc: number }, []>(
          "SELECT lcsc FROM component_catalog WHERE subcategory='Slide Switches'",
        )
        .all()) {
        if (!seen.has(row.lcsc)) observations.set(row.lcsc, null)
      }
    }
    const switchExists = hasTable(db, "switch")
    if (switchExists) {
      for (const row of db
        .query<{ lcsc: number }, []>(
          "SELECT lcsc FROM switch WHERE switch_type='Slide Switches'",
        )
        .all()) {
        if (!seen.has(row.lcsc)) observations.set(row.lcsc, null)
      }
    }
    const writeStock = createLiveStockWriter(db, checkedAt)
    const catalog = catalogExists
      ? db.prepare("UPDATE component_catalog SET stock=? WHERE lcsc=?")
      : null
    const switches = switchExists
      ? db.prepare('UPDATE "switch" SET stock=?, in_stock=? WHERE lcsc=?')
      : null
    for (const [lcsc, quantity] of observations) {
      writeStock(lcsc, quantity)
      catalog?.run(quantity, lcsc)
      switches?.run(quantity, Number(quantity !== null && quantity > 0), lcsc)
    }
  })()
}

if (import.meta.main) {
  // Validate the complete response before changing the prepared snapshot.
  const rows = await fetchSlideSwitchStock()
  const db = new Database(process.env.SOURCE_DB_PATH || "db.sqlite3")
  try {
    mergeSlideSwitchStock(db, rows)
    console.log(
      `Refreshed ${rows.length} slide-switch stock observations directly from JLCPCB`,
    )
    console.log(
      "C221660 live stock:",
      rows.find((row) => row.lcsc === 221660)?.stock ?? "unknown (not listed)",
    )
  } finally {
    db.close()
  }
}
