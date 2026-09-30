import { Database } from "bun:sqlite"

const ENDPOINT =
  "https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList/v2"

type EthernetControllerRow = {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: number
  package: string
  is_basic: number
  is_preferred: number
  attributes: string
}

export function normalizeEthernetControllers(row: any): EthernetControllerRow {
  if (
    row.componentTypeEn !== "Ethernet Controllers" ||
    !/^C\d+$/.test(row.componentCode) ||
    !row.componentModelEn ||
    !Number.isInteger(row.stockCount) ||
    row.stockCount < 0
  ) {
    throw new Error("Invalid Ethernet controller product in JLCPCB response")
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
    is_basic: Number(row.componentLibraryType === "base"),
    is_preferred: Number(row.preferredComponentFlag === true),
    attributes: JSON.stringify(attributes),
  }
}

export async function fetchEthernetControllers(fetcher: typeof fetch = fetch) {
  const rows = new Map<number, EthernetControllerRow>()
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
        firstSortName: "Interface",
        secondSortName: "Ethernet Controllers",
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
        "Incomplete JLCPCB Ethernet controller response; refusing replacement",
      )
    }
    total ??= info.total as number
    if (info.total !== total)
      throw new Error("JLCPCB total changed during fetch")
    for (const product of info.list) {
      const row = normalizeEthernetControllers(product)
      if (rows.has(row.lcsc))
        throw new Error(`Duplicate Ethernet controller C${row.lcsc}`)
      rows.set(row.lcsc, row)
    }
    if (rows.size === total) {
      if (![...rows.values()].some((row) => row.in_stock)) {
        throw new Error(
          "No in-stock Ethernet controllers; refusing replacement",
        )
      }
      return [...rows.values()]
    }
    if (rows.size > total)
      throw new Error("JLCPCB returned more rows than total")
    await Bun.sleep(250)
  }
  throw new Error("Ethernet controller pagination exceeded safety limit")
}

export function replaceEthernetControllers(
  db: Database,
  rows: EthernetControllerRow[],
) {
  if (!rows.length)
    throw new Error("Refusing an empty Ethernet controller replacement")
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS ethernet_controller (
      lcsc INTEGER PRIMARY KEY, mfr TEXT, description TEXT, stock INTEGER,
      price1 REAL, in_stock BOOLEAN, package TEXT, is_basic BOOLEAN,
      is_preferred BOOLEAN, attributes TEXT
    ); DELETE FROM ethernet_controller;`)
    const columns = Object.keys(rows[0])
    const insert = db.prepare(
      `INSERT INTO ethernet_controller (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    )
    for (const row of rows) insert.run(...Object.values(row))
    const hasCatalog = db
      .query(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='component_catalog'",
      )
      .get()
    if (hasCatalog) {
      const upsert =
        db.prepare(`INSERT INTO component_catalog (lcsc, category, subcategory, mfr, package, basic, preferred, description, stock, price, extra)
        VALUES (?, 'Interface', 'Ethernet Controllers', ?, ?, ?, ?, ?, ?, ?, ?)
`)
      const remove = db.prepare("DELETE FROM component_catalog WHERE lcsc = ?")
      for (const row of rows) {
        remove.run(row.lcsc)
        upsert.run(
          row.lcsc,
          row.mfr,
          row.package,
          row.is_basic,
          row.is_preferred,
          row.description,
          row.stock,
          row.price1 === null ? "" : `1-:${row.price1}`,
          JSON.stringify({
            number: `C${row.lcsc}`,
            mpn: row.mfr,
            title: row.mfr,
            package: row.package,
            description: row.description,
            attributes: JSON.parse(row.attributes),
          }),
        )
      }
    }
    if (
      db
        .query(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='component_stock'",
        )
        .get()
    ) {
      const stock = db.prepare(
        "INSERT INTO component_stock (lcsc,stock) VALUES (?,?) ON CONFLICT(lcsc) DO UPDATE SET stock=excluded.stock",
      )
      for (const row of rows) stock.run(row.lcsc, row.stock)
    }
  })()
}

if (import.meta.main) {
  // Fetch and validate every page before opening the prepared database for writes.
  const rows = await fetchEthernetControllers()
  const db = new Database(process.env.SOURCE_DB_PATH || "db.sqlite3")
  try {
    replaceEthernetControllers(db, rows)
    console.log(
      `Refreshed ${rows.length} Ethernet controllers directly from JLCPCB (${rows.filter((row) => row.in_stock).length} in stock)`,
    )
  } finally {
    db.close()
  }
}
