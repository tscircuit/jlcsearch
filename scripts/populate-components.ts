/**
 * Populate the components table from the JLCPCB CSV data file.
 *
 * Usage:
 *   bun scripts/populate-components.ts --file ./component_data.csv
 *
 * The CSV file is available from JLCPCB's parts library export.
 *
 * Column mapping from JLCPCB CSV:
 *   LCSC Part      -> lcsc
 *   First Category -> (used for category lookup)
 *   Second Category-> (used for category lookup)
 *   MFR.Part#      -> mfr
 *   Package        -> package
 *   Solder Joint   -> joints
 *   Library Type   -> is_basic / is_preferred / is_extended_promotional
 *   Description    -> description
 *   Stock          -> stock
 *   Price          -> price
 */

import { parse } from "csv-parse/sync"
import { readFileSync } from "fs"
import { getDb } from "../lib/db/get-db"

interface CsvRow {
  "LCSC Part": string
  "First Category": string
  "Second Category": string
  "MFR.Part#": string
  Package: string
  "Solder Joint": string
  "Library Type": string
  Description: string
  Stock: string
  Price: string
  Images: string
  Datasheet: string
  Extra?: string
  [key: string]: string | undefined
}

async function main() {
  const args = process.argv.slice(2)
  const fileIdx = args.indexOf("--file")
  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error("Usage: bun scripts/populate-components.ts --file <path>")
    process.exit(1)
  }
  const filePath = args[fileIdx + 1]

  console.log(`Reading CSV from ${filePath}...`)
  const content = readFileSync(filePath, "utf-8")
  const rows: CsvRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
  })

  console.log(`Parsed ${rows.length} rows`)

  const db = getDb()

  // Ensure the table has the is_extended_promotional column
  // (migration is handled in get-db, but run here too for safety)

  // Build category map
  const categoryMap = new Map<string, number>()

  // Upsert categories
  for (const row of rows) {
    const key = `${row["First Category"]}||${row["Second Category"]}`
    if (!categoryMap.has(key)) {
      const existing = await db
        .selectFrom("categories")
        .select("id")
        .where("category", "=", row["First Category"])
        .where("subcategory", "=", row["Second Category"])
        .executeTakeFirst()

      if (existing) {
        categoryMap.set(key, existing.id)
      } else {
        const inserted = await db
          .insertInto("categories")
          .values({
            category: row["First Category"],
            subcategory: row["Second Category"],
            component_count: 0,
          })
          .returning("id")
          .executeTakeFirst()
        if (inserted) {
          categoryMap.set(key, inserted.id)
        }
      }
    }
  }

  console.log(`Populated ${categoryMap.size} categories`)

  let inserted = 0
  let updated = 0
  const BATCH = 500

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    for (const row of batch) {
      const lcsc = parseInt(row["LCSC Part"].replace(/^C/, ""), 10)
      if (isNaN(lcsc)) continue

      const libraryType = (row["Library Type"] ?? "").toLowerCase()
      const is_basic = libraryType === "basic" ? 1 : 0
      const is_preferred = libraryType === "preferred" ? 1 : 0
      const is_extended_promotional =
        libraryType === "extended promotional" ||
        libraryType === "promotional" ||
        libraryType.includes("extended promotional")
          ? 1
          : 0

      const categoryKey = `${row["First Category"]}||${row["Second Category"]}`
      const category_id = categoryMap.get(categoryKey) ?? 0

      const joints = parseInt(row["Solder Joint"], 10) || 0
      const stock = parseInt(row["Stock"].replace(/,/g, ""), 10) || 0

      // Parse price: take the lowest price tier
      let price: number | null = null
      const priceStr = row["Price"]
      if (priceStr) {
        const firstPrice = priceStr.split(",")[0]
        const match = firstPrice.match(/[\d.]+/)
        if (match) price = parseFloat(match[0])
      }

      const component = {
        lcsc,
        category_id,
        mfr: row["MFR.Part#"] ?? "",
        package: row["Package"] ?? "",
        joints,
        description: row["Description"] ?? "",
        stock,
        price,
        last_update: new Date().toISOString(),
        extra: row["Extra"] ?? null,
        in_stock: stock > 0 ? 1 : 0,
        is_basic,
        is_preferred,
        is_extended_promotional,
        images: row["Images"] ?? null,
        datasheet: row["Datasheet"] ?? null,
      }

      // Check if exists
      const existing = await db
        .selectFrom("components")
        .select("lcsc")
        .where("lcsc", "=", lcsc)
        .executeTakeFirst()

      if (existing) {
        await db
          .updateTable("components")
          .set(component)
          .where("lcsc", "=", lcsc)
          .execute()
        updated++
      } else {
        await db.insertInto("components").values(component).execute()
        inserted++
      }
    }

    if ((i / BATCH) % 10 === 0) {
      console.log(
        `Progress: ${Math.min(i + BATCH, rows.length)}/${rows.length} (inserted: ${inserted}, updated: ${updated})`
      )
    }
  }

  console.log(
    `Done! Inserted: ${inserted}, Updated: ${updated}, Total: ${rows.length}`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
