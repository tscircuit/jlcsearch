/**
 * Populates the `components` table from the JLCPCB component data source.
 *
 * The source JSON uses the field `componentLibraryType` (or similar) to
 * indicate component tier:
 *   - "base"          → basic = 1
 *   - "expand"        → basic = 0  (standard extended)
 *   - "expand_special"→ is_extended_promotional = 1  (extended promotional)
 *
 * Run: bun scripts/populate-components.ts
 */

import { createDb } from "../lib/db"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const DATA_PATH =
  process.env.JLCPCB_PARTS_JSON ?? join(process.cwd(), "data", "parts.json")

interface RawComponent {
  componentCode?: string
  lcscPartNumber?: string
  /** e.g. "base" | "expand" | "expand_special" */
  componentLibraryType?: string
  componentTypeEn?: string
  stockCount?: number
  price?: string | { quantity: number; price: number }[]
  describe?: string
  encapStandard?: string
  solderJoint?: number
  brandNameEn?: string
  minPacketUnit?: number
  // ... other fields
  [key: string]: unknown
}

function parsePrices(
  price: RawComponent["price"],
): { price1: number | null; price10: number | null; price100: number | null } {
  if (!price) return { price1: null, price10: null, price100: null }

  let tiers: { quantity: number; price: number }[] = []

  if (typeof price === "string") {
    try {
      tiers = JSON.parse(price)
    } catch {
      return { price1: null, price10: null, price100: null }
    }
  } else if (Array.isArray(price)) {
    tiers = price
  }

  const get = (minQty: number) => {
    // Find the tier whose minimum quantity is <= minQty, take the last such tier
    const matching = tiers
      .filter((t) => t.quantity <= minQty)
      .sort((a, b) => b.quantity - a.quantity)
    return matching[0]?.price ?? null
  }

  return {
    price1: get(1),
    price10: get(10),
    price100: get(100),
  }
}

async function main() {
  const db = createDb()

  // Ensure column exists (idempotent guard for fresh runs before migration)
  try {
    await db.schema
      .alterTable("components")
      .addColumn("is_extended_promotional", "integer", (col) =>
        col.defaultTo(0).notNull(),
      )
      .execute()
    console.log("Added is_extended_promotional column")
  } catch {
    // Column already exists — that's fine
  }

  const raw = readFileSync(DATA_PATH, "utf-8")
  const parts: RawComponent[] = JSON.parse(raw)

  console.log(`Loaded ${parts.length} parts from ${DATA_PATH}`)

  const BATCH = 500
  let inserted = 0

  for (let i = 0; i < parts.length; i += BATCH) {
    const batch = parts.slice(i, i + BATCH)

    const rows = batch
      .map((p) => {
        const lcsc = Number(
          (p.lcscPartNumber ?? p.componentCode ?? "").replace(/\D/g, ""),
        )
        if (!lcsc) return null

        const libraryType = (p.componentLibraryType ?? "").toLowerCase()
        const basic = libraryType === "base" ? 1 : 0
        const preferred = libraryType === "preferred" ? 1 : 0
        const isExtendedPromotional =
          libraryType === "expand_special" ? 1 : 0

        const { price1, price10, price100 } = parsePrices(p.price)

        return {
          lcsc,
          mfr: String(p.componentCode ?? p.lcscPartNumber ?? ""),
          description: String(p.describe ?? ""),
          package: p.encapStandard ? String(p.encapStandard) : null,
          joints: p.solderJoint ? Number(p.solderJoint) : null,
          manufacturer: p.brandNameEn ? String(p.brandNameEn) : null,
          basic,
          preferred,
          is_extended_promotional: isExtendedPromotional,
          stock: p.stockCount ? Number(p.stockCount) : null,
          price1,
          price10,
          price100,
          last_updated: new Date().toISOString(),
        }
      })
      .filter(Boolean) as object[]

    if (rows.length === 0) continue

    await db
      .insertInto("components")
      .values(rows as any)
      .onConflict((oc) =>
        oc.column("lcsc").doUpdateSet((eb) => ({
          description: eb.ref("excluded.description"),
          package: eb.ref("excluded.package"),
          joints: eb.ref("excluded.joints"),
          manufacturer: eb.ref("excluded.manufacturer"),
          basic: eb.ref("excluded.basic"),
          preferred: eb.ref("excluded.preferred"),
          is_extended_promotional: eb.ref(
            "excluded.is_extended_promotional",
          ),
          stock: eb.ref("excluded.stock"),
          price1: eb.ref("excluded.price1"),
          price10: eb.ref("excluded.price10"),
          price100: eb.ref("excluded.price100"),
          last_updated: eb.ref("excluded.last_updated"),
        })),
      )
      .execute()

    inserted += rows.length
    if (inserted % 10_000 === 0) {
      console.log(`  ${inserted} / ${parts.length} upserted…`)
    }
  }

  console.log(`Done. Upserted ${inserted} components.`)
  await db.destroy()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
