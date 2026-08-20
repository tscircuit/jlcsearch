/**
 * Script to import components from JLCPCB data source CSV/JSON files.
 *
 * Usage:
 *   bun scripts/import-components.ts --file <path>
 *
 * The data source JSON includes a `componentLibraryType` field which can be:
 *   - "base"      → is_basic = 1
 *   - "expand"    → is_preferred = 1  (was formerly known as "preferred")
 *   - "extend"    → regular extended
 *   - "promotion" → is_extended_promotional = 1  (extended but promotional/temporary basic)
 *
 * Some datasets use a numeric `libraryType` field instead:
 *   0 = base, 1 = preferred, 2 = extended, 3 = extended promotional
 */

import { parseArgs } from "node:util"
import { createReadStream } from "node:fs"
import * as readline from "node:readline"
import { getDb } from "../lib/db/get-db"

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    file: { type: "string" },
    reset: { type: "boolean", default: false },
  },
})

if (!values.file) {
  console.error("Usage: bun scripts/import-components.ts --file <path>")
  process.exit(1)
}

const db = getDb()

/**
 * Map a raw component record from the JLCPCB data source to our DB row shape.
 */
function mapComponent(raw: Record<string, any>) {
  const libType: string = (
    raw.componentLibraryType ??
    raw.libraryType ??
    ""
  )
    .toString()
    .toLowerCase()

  // Numeric mapping used in some dataset versions
  const libTypeNum =
    typeof raw.libraryType === "number" ? raw.libraryType : undefined

  const is_basic =
    libType === "base" || libTypeNum === 0 ? 1 : 0
  const is_preferred =
    libType === "expand" || libType === "preferred" || libTypeNum === 1 ? 1 : 0
  const is_extended_promotional =
    libType === "promotion" ||
    libType === "extended_promotional" ||
    libType === "promotionextend" ||
    libTypeNum === 3
      ? 1
      : 0

  // Price is often stored as a stringified JSON array of { quantity, price } pairs
  let price1: number | null = null
  try {
    const priceRaw = raw.price ?? raw.prices ?? null
    if (typeof priceRaw === "string") {
      const parsed = JSON.parse(priceRaw) as Array<{
        quantity?: number
        price?: number | string
      }>
      if (Array.isArray(parsed) && parsed.length > 0) {
        price1 = Number(parsed[0].price ?? 0)
      }
    } else if (typeof priceRaw === "number") {
      price1 = priceRaw
    }
  } catch {
    /* ignore parse errors */
  }

  return {
    lcsc: Number(raw.lcsc ?? raw.componentCode?.replace(/^C/, "") ?? 0),
    mfr: String(raw.mfr ?? raw.brand ?? raw.manufacturer ?? ""),
    description: String(raw.description ?? raw.describe ?? ""),
    package: raw.package ?? raw.encap ?? null,
    stock: Number(raw.stock ?? raw.stockCount ?? 0),
    price1,
    in_stock: Number(raw.stock ?? raw.stockCount ?? 0) > 0 ? 1 : 0,
    is_basic,
    is_preferred,
    is_extended_promotional,
    voltage_rating: raw.voltage_rating ?? null,
    current_rating: raw.current_rating ?? null,
    power_rating: raw.power_rating ?? null,
    resistance: raw.resistance ?? null,
    capacitance: raw.capacitance ?? null,
    inductance: raw.inductance ?? null,
    tolerance: raw.tolerance ?? null,
    frequency: raw.frequency ?? null,
    extra: raw.extra ? JSON.stringify(raw.extra) : null,
    datasheet_url: raw.datasheet ?? raw.datasheetUrl ?? null,
    mfr_img_url: raw.image ?? raw.mfrImgUrl ?? null,
  }
}

async function main() {
  console.log(`Importing from: ${values.file}`)

  if (values.reset) {
    console.log("Resetting components table…")
    await db.deleteFrom("components").execute()
  }

  const rl = readline.createInterface({
    input: createReadStream(values.file!),
    crlfDelay: Number.POSITIVE_INFINITY,
  })

  const BATCH_SIZE = 500
  let batch: ReturnType<typeof mapComponent>[] = []
  let total = 0

  async function flush() {
    if (batch.length === 0) return
    await db
      .insertInto("components")
      .values(batch)
      .onConflict((oc) =>
        oc.column("lcsc").doUpdateSet((eb) => ({
          mfr: eb.ref("excluded.mfr"),
          description: eb.ref("excluded.description"),
          package: eb.ref("excluded.package"),
          stock: eb.ref("excluded.stock"),
          price1: eb.ref("excluded.price1"),
          in_stock: eb.ref("excluded.in_stock"),
          is_basic: eb.ref("excluded.is_basic"),
          is_preferred: eb.ref("excluded.is_preferred"),
          is_extended_promotional: eb.ref("excluded.is_extended_promotional"),
          voltage_rating: eb.ref("excluded.voltage_rating"),
          current_rating: eb.ref("excluded.current_rating"),
          power_rating: eb.ref("excluded.power_rating"),
          resistance: eb.ref("excluded.resistance"),
          capacitance: eb.ref("excluded.capacitance"),
          inductance: eb.ref("excluded.inductance"),
          tolerance: eb.ref("excluded.tolerance"),
          frequency: eb.ref("excluded.frequency"),
          extra: eb.ref("excluded.extra"),
          datasheet_url: eb.ref("excluded.datasheet_url"),
          mfr_img_url: eb.ref("excluded.mfr_img_url"),
        })),
      )
      .execute()
    total += batch.length
    console.log(`  Upserted ${total} rows…`)
    batch = []
  }

  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let raw: Record<string, any>
    try {
      raw = JSON.parse(trimmed)
    } catch {
      continue
    }
    batch.push(mapComponent(raw))
    if (batch.length >= BATCH_SIZE) {
      await flush()
    }
  }
  await flush()

  console.log(`Done. Imported ${total} components.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
