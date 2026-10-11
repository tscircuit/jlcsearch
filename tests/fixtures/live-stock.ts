import { Database } from "bun:sqlite"
import type { Execute } from "../../scripts/crawl-live-stock"

export async function stockDatabase() {
  const db = new Database(":memory:")
  db.exec(
    await Bun.file(
      new URL("../../cf-proxy/migrations/0017_live_stock.sql", import.meta.url),
    ).text(),
  )
  for (const table of ["component_catalog", "search_index", "switch"]) {
    db.exec(`CREATE TABLE "${table}" (lcsc INTEGER PRIMARY KEY, stock INTEGER,
      in_stock INTEGER, category TEXT, subcategory TEXT, mfr TEXT)`)
  }
  const execute: Execute = async (sql) => {
    if (/^\s*SELECT\b/i.test(sql)) return db.query(sql).all()
    db.exec(sql)
    return []
  }
  const targets = ["component_catalog", "search_index", "switch"].map(
    (name) => ({ name, has_in_stock: 1 }),
  )
  return { db, execute, targets }
}

export const insertPart = (db: Database, lcsc: number, stock = 2184) => {
  for (const table of ["component_catalog", "search_index", "switch"])
    db.query(
      `INSERT INTO "${table}" VALUES (?,?,1,'Switches','Slide Switches','part')`,
    ).run(lcsc, stock)
}

export const response = (total: number, codes: number[], stock = 0) =>
  Response.json({
    code: 200,
    data: {
      componentPageInfo: {
        total,
        list: codes.map((lcsc) => ({
          componentCode: `C${lcsc}`,
          componentTypeEn: "Slide Switches",
          stockCount: stock,
        })),
      },
    },
  })

export const category = () => ({
  category: "Switches",
  subcategory: "Slide Switches",
  next_page: 1,
  cycle: "",
  expected_total: null,
})
