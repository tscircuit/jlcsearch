import { Database } from "bun:sqlite"
import { springClampTerminalBlockTableSpec } from "../lib/db/derivedtables/spring-clamp-terminal-block"

const ENDPOINT =
  "https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList/v2"

type SpringClampRow = {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: number
  package: string
  pitch_mm: number | null
  num_pins: number | null
  voltage_rating: number | null
  current_rating: number | null
  wire_gauge_mm2: number | null
  wire_gauge_awg: string | null
  mounting_style: string | null
  is_basic: number
  is_preferred: number
  attributes: string
}

export function normalizeSpringClamp(row: any): SpringClampRow {
  if (
    row.componentTypeEn !== "Spring Clamp System Terminal Block" ||
    !/^C\d+$/.test(row.componentCode) ||
    !row.componentModelEn ||
    !Number.isInteger(row.stockCount) ||
    row.stockCount < 0
  ) {
    throw new Error("Invalid spring-clamp product in JLCPCB response")
  }
  const attributes: Record<string, string> = {}
  for (const attr of row.attributes ?? []) {
    if (attr.attribute_name_en && attr.attribute_value_name != null) {
      attributes[attr.attribute_name_en] = String(attr.attribute_value_name)
    }
  }
  const prices = (row.componentPrices ?? [])
    .filter(
      (p: any) =>
        Number.isFinite(p.startNumber) &&
        Number.isFinite(p.productPrice) &&
        p.productPrice >= 0,
    )
    .sort((a: any, b: any) => a.startNumber - b.startNumber)
  // Reuse the derived-table parser so live and archive imports agree.
  const [mapped] = springClampTerminalBlockTableSpec.mapToTable([
    {
      lcsc: Number(row.componentCode.slice(1)),
      mfr: row.componentModelEn,
      description: [row.componentBrandEn, row.describe]
        .filter(Boolean)
        .join(" "),
      stock: row.stockCount,
      price: JSON.stringify(
        prices.map((p: any) => ({ price: p.productPrice })),
      ),
      package: row.componentSpecificationEn ?? "",
      basic: Number(row.componentLibraryType === "base"),
      preferred: Number(row.preferredComponentFlag === true),
      extra: JSON.stringify({
        attributes: { ...attributes, Manufacturer: row.componentBrandEn ?? "" },
      }),
    } as any,
  ])
  if (!mapped) throw new Error("Could not parse spring-clamp product")
  return {
    ...mapped,
    in_stock: Number(mapped.in_stock),
    is_basic: Number(mapped.is_basic),
    is_preferred: Number(mapped.is_preferred),
    attributes: JSON.stringify(mapped.attributes),
  } as SpringClampRow
}

export async function fetchSpringClampConnectors(
  fetcher: typeof fetch = fetch,
) {
  const rows = new Map<number, SpringClampRow>()
  let total: number | undefined
  for (let page = 1; page <= 200; page++) {
    const response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        currentPage: page,
        pageSize: 100,
        keyword: "",
        firstSortName: "Connectors",
        secondSortName: "Spring Clamp System Terminal Block",
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
      !Number.isInteger(info?.total) ||
      info.total <= 0 ||
      !Array.isArray(info.list) ||
      info.list.length === 0
    ) {
      throw new Error(
        "Incomplete JLCPCB spring-clamp response; refusing replacement",
      )
    }
    total ??= info.total as number
    if (info.total !== total)
      throw new Error("JLCPCB total changed during fetch")
    for (const product of info.list) {
      const row = normalizeSpringClamp(product)
      if (rows.has(row.lcsc))
        throw new Error(`Duplicate spring-clamp C${row.lcsc}`)
      rows.set(row.lcsc, row)
    }
    if (rows.size === total) {
      if (![...rows.values()].some((row) => row.in_stock)) {
        throw new Error(
          "No in-stock spring-clamp connectors; refusing replacement",
        )
      }
      return [...rows.values()]
    }
    if (rows.size > total)
      throw new Error("JLCPCB returned more rows than total")
    await Bun.sleep(250)
  }
  throw new Error("Spring-clamp pagination exceeded safety limit")
}

export function replaceSpringClampConnectors(
  db: Database,
  rows: SpringClampRow[],
) {
  if (!rows.length)
    throw new Error("Refusing an empty spring-clamp replacement")
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS spring_clamp_terminal_block (
      lcsc INTEGER PRIMARY KEY, mfr TEXT, description TEXT, stock INTEGER,
      price1 REAL, in_stock BOOLEAN, package TEXT, pitch_mm REAL, num_pins INTEGER,
      voltage_rating REAL, current_rating REAL, wire_gauge_mm2 REAL,
      wire_gauge_awg TEXT, mounting_style TEXT, is_basic BOOLEAN,
      is_preferred BOOLEAN, attributes TEXT
    ); DELETE FROM spring_clamp_terminal_block;`)
    const columns = Object.keys(rows[0])
    const insert = db.prepare(
      `INSERT INTO spring_clamp_terminal_block (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    )
    for (const row of rows) insert.run(...Object.values(row))
  })()
}

if (import.meta.main) {
  // Fetch and validate every page before opening the prepared database for writes.
  const rows = await fetchSpringClampConnectors()
  const db = new Database(process.env.SOURCE_DB_PATH || "db.sqlite3")
  try {
    replaceSpringClampConnectors(db, rows)
    console.log(
      `Refreshed ${rows.length} spring-clamp connectors directly from JLCPCB (${rows.filter((row) => row.in_stock).length} in stock)`,
    )
  } finally {
    db.close()
  }
}
