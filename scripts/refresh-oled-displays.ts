import { Database } from "bun:sqlite"

const ENDPOINT =
  "https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList/v2"

type OledRow = {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: number
  package: string
  protocol: string | null
  display_width: string | null
  pixel_resolution: string | null
  is_basic: number
  is_preferred: number
  attributes: string
}

export function normalizeOled(row: any): OledRow {
  if (
    row.componentTypeEn !== "OLED Display" ||
    !/^C\d+$/.test(row.componentCode) ||
    !row.componentModelEn ||
    !Number.isInteger(row.stockCount) ||
    row.stockCount < 0
  ) {
    throw new Error("Invalid OLED product in JLCPCB response")
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
  const description = String(row.describe ?? "")
  return {
    lcsc: Number(row.componentCode.slice(1)),
    mfr: row.componentModelEn,
    description,
    stock: row.stockCount,
    price1: prices[0]?.productPrice ?? null,
    in_stock: Number(row.stockCount > 0),
    package: row.componentSpecificationEn ?? "",
    protocol: attributes.Interface ?? null,
    display_width: attributes.Size ?? null,
    pixel_resolution:
      attributes["Dot Pixels"] ??
      description.match(/(?:^|\s)(\d+x\d+)(?=\s|$)/)?.[1] ??
      null,
    is_basic: Number(row.componentLibraryType === "base"),
    is_preferred: Number(row.preferredComponentFlag === true),
    attributes: JSON.stringify(attributes),
  }
}

export async function fetchOledDisplays(fetcher: typeof fetch = fetch) {
  const rows = new Map<number, OledRow>()
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
        firstSortName: "Displays",
        secondSortName: "OLED Display",
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
      throw new Error("Incomplete JLCPCB OLED response; refusing replacement")
    }
    total ??= info.total as number
    if (info.total !== total)
      throw new Error("JLCPCB total changed during fetch")
    for (const product of info.list) {
      const row = normalizeOled(product)
      if (rows.has(row.lcsc)) throw new Error(`Duplicate OLED C${row.lcsc}`)
      rows.set(row.lcsc, row)
    }
    if (rows.size === total) {
      if (![...rows.values()].some((row) => row.in_stock)) {
        throw new Error("No in-stock OLED displays; refusing replacement")
      }
      return [...rows.values()]
    }
    if (rows.size > total)
      throw new Error("JLCPCB returned more rows than total")
    await Bun.sleep(250)
  }
  throw new Error("OLED pagination exceeded safety limit")
}

export function replaceOledDisplays(db: Database, rows: OledRow[]) {
  if (!rows.length) throw new Error("Refusing an empty OLED replacement")
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS oled_display (
      lcsc INTEGER PRIMARY KEY, mfr TEXT, description TEXT, stock INTEGER,
      price1 REAL, in_stock BOOLEAN, package TEXT, protocol TEXT,
      display_width TEXT, pixel_resolution TEXT, is_basic BOOLEAN,
      is_preferred BOOLEAN, attributes TEXT
    ); DELETE FROM oled_display;`)
    const columns = Object.keys(rows[0])
    const insert = db.prepare(
      `INSERT INTO oled_display (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    )
    for (const row of rows) insert.run(...Object.values(row))
  })()
}

if (import.meta.main) {
  // Fetch and validate every page before opening the prepared database for writes.
  const rows = await fetchOledDisplays()
  const db = new Database(process.env.SOURCE_DB_PATH || "db.sqlite3")
  try {
    replaceOledDisplays(db, rows)
    console.log(
      `Refreshed ${rows.length} OLED displays directly from JLCPCB (${rows.filter((row) => row.in_stock).length} in stock)`,
    )
  } finally {
    db.close()
  }
}
