import { expect, test, describe, beforeAll } from "bun:test"
import { getTestDb } from "../fixtures/get-test-db"
import { setupDb } from "../../lib/db/setup-db"

describe("GET /components/list - is_extended_promotional filter", () => {
  let db: Awaited<ReturnType<typeof getTestDb>>

  beforeAll(async () => {
    db = await getTestDb()
    await setupDb(db)

    // Insert test categories
    await db
      .insertInto("categories")
      .values({ category: "Resistors", subcategory: "Chip Resistor", component_count: 3 })
      .execute()

    const cat = await db
      .selectFrom("categories")
      .select("id")
      .where("category", "=", "Resistors")
      .executeTakeFirstOrThrow()

    // Insert a basic component
    await db
      .insertInto("components")
      .values({
        lcsc: 1001,
        category_id: cat.id,
        mfr: "BASIC-MFR",
        package: "0402",
        joints: 2,
        description: "Basic resistor",
        stock: 100,
        price: 0.01,
        last_update: new Date().toISOString(),
        extra: null,
        in_stock: 1,
        is_basic: 1,
        is_preferred: 0,
        is_extended_promotional: 0,
        images: null,
        datasheet: null,
      })
      .execute()

    // Insert an extended promotional component
    await db
      .insertInto("components")
      .values({
        lcsc: 1002,
        category_id: cat.id,
        mfr: "PROMO-MFR",
        package: "0603",
        joints: 2,
        description: "Extended promotional component",
        stock: 50,
        price: 0.02,
        last_update: new Date().toISOString(),
        extra: null,
        in_stock: 1,
        is_basic: 0,
        is_preferred: 0,
        is_extended_promotional: 1,
        images: null,
        datasheet: null,
      })
      .execute()

    // Insert a regular extended component
    await db
      .insertInto("components")
      .values({
        lcsc: 1003,
        category_id: cat.id,
        mfr: "EXT-MFR",
        package: "0805",
        joints: 2,
        description: "Regular extended component",
        stock: 0,
        price: 0.05,
        last_update: new Date().toISOString(),
        extra: null,
        in_stock: 0,
        is_basic: 0,
        is_preferred: 0,
        is_extended_promotional: 0,
        images: null,
        datasheet: null,
      })
      .execute()
  })

  test("is_extended_promotional=true returns only promotional components", async () => {
    const rows = await db
      .selectFrom("components")
      .selectAll()
      .where("is_extended_promotional", "=", 1)
      .execute()

    expect(rows.length).toBe(1)
    expect(rows[0].lcsc).toBe(1002)
    expect(Boolean(rows[0].is_extended_promotional)).toBe(true)
  })

  test("is_extended_promotional=false returns non-promotional components", async () => {
    const rows = await db
      .selectFrom("components")
      .selectAll()
      .where("is_extended_promotional", "=", 0)
      .execute()

    expect(rows.length).toBe(2)
    expect(rows.every((r) => !r.is_extended_promotional)).toBe(true)
  })

  test("components schema includes is_extended_promotional field", async () => {
    const row = await db
      .selectFrom("components")
      .selectAll()
      .where("lcsc", "=", 1002)
      .executeTakeFirst()

    expect(row).toBeDefined()
    expect("is_extended_promotional" in row!).toBe(true)
  })

  test("is_basic and is_extended_promotional are mutually exclusive in test data", async () => {
    const basicRow = await db
      .selectFrom("components")
      .selectAll()
      .where("lcsc", "=", 1001)
      .executeTakeFirst()

    const promoRow = await db
      .selectFrom("components")
      .selectAll()
      .where("lcsc", "=", 1002)
      .executeTakeFirst()

    expect(Boolean(basicRow?.is_basic)).toBe(true)
    expect(Boolean(basicRow?.is_extended_promotional)).toBe(false)

    expect(Boolean(promoRow?.is_basic)).toBe(false)
    expect(Boolean(promoRow?.is_extended_promotional)).toBe(true)
  })
})
