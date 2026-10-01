import { Database } from "bun:sqlite"
import {
  getOpticalSensorType,
  opticalSensorTableSpec,
} from "../lib/db/derivedtables/optical-sensor"

const ENDPOINT =
  "https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList/v2"

// Current JLCPCB taxonomy: https://jlcpcb.com/parts/all-electronic-components
// Mixed categories are scanned as well: mouse, ranging, dust and optical-flow
// sensors are often sold as Specialized Sensors or Sensor Modules.
export const OPTICAL_CATALOG_SOURCES = [
  { category: "Sensors", subcategory: "Temperature Sensors" },
  { category: "Sensors", subcategory: "Human Body Sensing Sensor" },
  { category: "Sensors", subcategory: "Position Sensors" },
  { category: "Switches", subcategory: "Rotary Encoders" },
  { category: "Industrial control electrical", subcategory: "Encoder" },
  { category: "Sensors", subcategory: "Ambient Light Sensors" },
  { category: "Sensors", subcategory: "Fiber Optic / Laser Sensors" },
  { category: "Sensors", subcategory: "Image Sensors" },
  {
    category: "Sensors",
    subcategory: "Photointerrupters - Slot Type - Logic Output",
  },
  { category: "Sensors", subcategory: "Photoresistors" },
  { category: "Sensors", subcategory: "Specialized Sensors" },
  { category: "Sensors", subcategory: "Proximity Sensors" },
  { category: "Sensors", subcategory: "Sensor Modules" },
  { category: "Optoelectronics", subcategory: "Photodiodes" },
  { category: "Optoelectronics", subcategory: "Phototransistors" },
  {
    category: "Optoelectronics",
    subcategory: "Reflective Optical Interrupters",
  },
  {
    category: "Optoelectronics",
    subcategory: "Photointerrupters - Slot Type - Transistor Output",
  },
  {
    category: "Optoelectronics",
    subcategory: "Infrared Remote Receiver (IRM)",
  },
  {
    category: "Industrial control electrical",
    subcategory: "Photoelectric sensor",
  },
]

export type OpticalSensorRow = {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: number
  package: string
  sensor_type: string
  is_basic: number
  is_preferred: number
  attributes: string
}

export function normalizeOpticalSensor(product: any): OpticalSensorRow | null {
  if (
    !/^C\d+$/.test(product.componentCode) ||
    !product.componentModelEn ||
    !Number.isSafeInteger(product.stockCount) ||
    product.stockCount < 0
  )
    throw new Error("Invalid optical sensor product in JLCPCB response")
  const attributes: Record<string, string> = {}
  for (const attr of product.attributes ?? []) {
    if (attr.attribute_name_en && attr.attribute_value_name != null) {
      attributes[attr.attribute_name_en] = String(attr.attribute_value_name)
    }
  }
  const description = String(product.describe ?? "")
  const sensorType = getOpticalSensorType({
    mfr: product.componentModelEn,
    description,
    subcategory: product.componentTypeEn ?? "",
    attributes,
  })
  if (!sensorType) return null
  const prices = (product.componentPrices ?? [])
    .filter(
      (p: any) =>
        Number.isFinite(p.startNumber) &&
        Number.isFinite(p.productPrice) &&
        p.productPrice >= 0,
    )
    .sort((a: any, b: any) => a.startNumber - b.startNumber)
  return {
    lcsc: Number(product.componentCode.slice(1)),
    mfr: product.componentModelEn,
    description,
    stock: product.stockCount,
    price1: prices[0]?.productPrice ?? null,
    in_stock: Number(product.stockCount > 0),
    package: product.componentSpecificationEn ?? "",
    sensor_type: sensorType,
    is_basic: Number(product.componentLibraryType === "base"),
    is_preferred: Number(product.preferredComponentFlag === true),
    attributes: JSON.stringify(attributes),
  }
}

export async function fetchOpticalSensors(
  fetcher: typeof fetch = fetch,
  sources = OPTICAL_CATALOG_SOURCES,
  logger: (message: string) => void = () => {},
) {
  const rows = new Map<number, OpticalSensorRow>()
  for (const source of sources) {
    let total: number | undefined
    const seen = new Set<string>()
    for (let page = 1; page <= 100; page++) {
      const response = await fetcher(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          currentPage: page,
          pageSize: 100,
          keyword: "",
          firstSortName: source.category,
          secondSortName: source.subcategory,
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
      // Empty categories are allowed, but cannot erase a previously nonempty
      // page or allow a partial import. Validate raw product counts before filtering.
      if (
        body.code !== 200 ||
        !Number.isSafeInteger(info?.total) ||
        info.total < 0 ||
        (info.total > 0 &&
          (!Array.isArray(info.list) || info.list.length === 0)) ||
        (info.total === 0 &&
          info.list != null &&
          (!Array.isArray(info.list) || info.list.length !== 0))
      ) {
        throw new Error(
          `Incomplete JLCPCB optical response for ${source.subcategory}`,
        )
      }
      total ??= info.total as number
      if (info.total !== total)
        throw new Error("JLCPCB total changed during fetch")
      for (const product of info.list ?? []) {
        if (product.componentTypeEn !== source.subcategory)
          throw new Error(
            `Wrong category in JLCPCB ${source.subcategory} response`,
          )
        if (seen.has(product.componentCode))
          throw new Error(`Duplicate optical product ${product.componentCode}`)
        seen.add(product.componentCode)
        const row = normalizeOpticalSensor(product)
        if (row) rows.set(row.lcsc, row)
      }
      if (seen.size === total) break
      if (seen.size > total)
        throw new Error("JLCPCB returned more rows than total")
      if (page === 100)
        throw new Error("Optical sensor pagination exceeded safety limit")
      await Bun.sleep(250)
    }
    logger(`Checked ${seen.size} live products in ${source.subcategory}`)
  }
  if (!rows.size)
    throw new Error("Refusing an empty live optical sensor snapshot")
  return [...rows.values()]
}

export function mergeOpticalSensors(db: Database, rows: OpticalSensorRow[]) {
  if (!rows.length) throw new Error("Refusing an empty optical sensor refresh")
  db.transaction(() => {
    // Merge with the prepared table so upstream types beyond the live query
    // categories are retained. Live stock/prices take precedence, including zero.
    db.exec(`CREATE TABLE IF NOT EXISTS optical_sensor (
      lcsc INTEGER PRIMARY KEY, mfr TEXT, description TEXT, stock INTEGER,
      price1 REAL, in_stock BOOLEAN, package TEXT, sensor_type TEXT,
      is_basic BOOLEAN, is_preferred BOOLEAN, attributes TEXT
    );`)
    for (const index of opticalSensorTableSpec.indexes ?? []) {
      db.exec(
        `CREATE INDEX IF NOT EXISTS ${index.name} ON optical_sensor (${index.columns.join(",")})`,
      )
    }
    const columns = Object.keys(rows[0])
    const insert = db.prepare(`INSERT INTO optical_sensor (${columns.join(",")})
      VALUES (${columns.map(() => "?").join(",")})
      ON CONFLICT(lcsc) DO UPDATE SET ${columns
        .filter((c) => c !== "lcsc")
        .map((c) => `${c}=excluded.${c}`)
        .join(",")}`)
    const seen = new Set<number>()
    const hasStock = db
      .query(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='component_stock'",
      )
      .get()
    const stock = hasStock
      ? db.prepare(
          "INSERT INTO component_stock (lcsc,stock) VALUES (?,?) ON CONFLICT(lcsc) DO UPDATE SET stock=excluded.stock",
        )
      : null
    for (const row of rows) {
      if (seen.has(row.lcsc))
        throw new Error(`Duplicate optical sensor C${row.lcsc}`)
      seen.add(row.lcsc)
      insert.run(...columns.map((c) => row[c as keyof OpticalSensorRow]))
      stock?.run(row.lcsc, row.stock)
    }
  })()
}

if (import.meta.main) {
  const rows = await fetchOpticalSensors(
    fetch,
    OPTICAL_CATALOG_SOURCES,
    console.log,
  )
  // A listed, zero-stock navigation sensor must survive every refresh. This
  // specifically prevents the missing-PMW3360 regression from going unnoticed.
  if (
    !rows.some((row) => row.lcsc === 20612443 && row.mfr === "PMW3360DM-T2QU")
  ) {
    throw new Error("Live optical refresh is missing PMW3360 C20612443")
  }
  const db = new Database(process.env.SOURCE_DB_PATH || "db.sqlite3")
  try {
    mergeOpticalSensors(db, rows)
    console.log(
      `Refreshed ${rows.length} optical sensors (${rows.filter((row) => row.in_stock).length} in stock, ${rows.filter((row) => row.sensor_type === "Optical Motion").length} motion sensors)`,
    )
  } finally {
    db.close()
  }
}
