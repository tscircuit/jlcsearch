import { test, expect } from "bun:test"
import { getDbClient } from "lib/db/get-db-client"

test("extended_promotional column has both 0 and 1 values in the database", async () => {
  const db = getDbClient()

  // Count components with extended_promotional = 1
  const promoResult = await db
    .selectFrom("components")
    .select(db.fn.countAll().as("count"))
    .where("extended_promotional", "=", 1)
    .executeTakeFirst()

  // Count components with extended_promotional = 0
  const nonPromoResult = await db
    .selectFrom("components")
    .select(db.fn.countAll().as("count"))
    .where("extended_promotional", "=", 0)
    .executeTakeFirst()

  const promoCount = Number(promoResult?.count ?? 0)
  const nonPromoCount = Number(nonPromoResult?.count ?? 0)

  // Both values must exist - this proves the data was sourced from JLCPCB,
  // not defaulted to 0 for all rows
  expect(promoCount).toBeGreaterThan(0)
  expect(nonPromoCount).toBeGreaterThan(0)

  // Extended promotional should be a small subset (typically ~1200-1600 out of 7M+)
  expect(promoCount).toBeLessThan(nonPromoCount)

  await db.destroy()
})

test("extended_promotional values match JLCPCB definition: expand type in basic+preferred query", async () => {
  const db = getDbClient()

  // Components that are basic AND extended_promotional should not exist
  // (basic parts are componentLibraryType="base", extended promotional are "expand" type)
  const basicAndPromo = await db
    .selectFrom("components")
    .select(db.fn.countAll().as("count"))
    .where("basic", "=", 1)
    .where("extended_promotional", "=", 1)
    .executeTakeFirst()

  // Basic parts should not be marked as extended promotional
  expect(Number(basicAndPromo?.count ?? 0)).toBe(0)

  await db.destroy()
})
