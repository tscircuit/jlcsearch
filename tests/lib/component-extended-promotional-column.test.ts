import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { componentExtendedPromotionalColumn } from "lib/db/optimizations/component-extended-promotional-column"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"

const makeDb = () => {
  const sqlite = new Database(":memory:")
  sqlite.exec(`
    CREATE TABLE components (
      lcsc INTEGER PRIMARY KEY,
      basic INTEGER NOT NULL DEFAULT 0,
      extra TEXT
    );
  `)
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database: sqlite }),
  }) as unknown as KyselyDatabaseInstance
  return { db, sqlite }
}

const promoExtra = JSON.stringify({
  attributes: { "Library Type": "Basic/Promotional Extended" },
})
const extendedExtra = JSON.stringify({
  attributes: { "Library Type": "Extended" },
})

test("generated is_extended_promotional column derives the flag from source data", async () => {
  const { db, sqlite } = makeDb()

  // 1: extended promotional, 2: basic (promo wording but basic), 3: plain extended
  sqlite.exec(
    `INSERT INTO components (lcsc, basic, extra) VALUES
      (1, 0, '${promoExtra}'),
      (2, 1, '${promoExtra}'),
      (3, 0, '${extendedExtra}'),
      (4, 0, NULL);`,
  )

  expect(await componentExtendedPromotionalColumn.checkIfAdded(db)).toBe(false)
  await componentExtendedPromotionalColumn.execute(db)
  expect(await componentExtendedPromotionalColumn.checkIfAdded(db)).toBe(true)

  const rows = sqlite
    .query("SELECT lcsc, is_extended_promotional FROM components ORDER BY lcsc")
    .all() as Array<{ lcsc: number; is_extended_promotional: number }>

  const byLcsc = Object.fromEntries(
    rows.map((r) => [r.lcsc, r.is_extended_promotional]),
  )

  expect(byLcsc[1]).toBe(1) // extended + promotional -> true
  expect(byLcsc[2]).toBe(0) // basic part -> false
  expect(byLcsc[3]).toBe(0) // plain extended -> false
  expect(byLcsc[4]).toBe(0) // no extra data -> false

  await db.destroy()
})
