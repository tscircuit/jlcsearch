import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { componentExtendedPromotionalColumn } from "../../lib/db/optimizations/component-extended-promotional-column"

test("adds a queryable generated alias to an empty legacy components table", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({ dialect: new BunSqliteDialect({ database }) })
  try {
    database.exec(`CREATE TABLE components (
      lcsc INTEGER PRIMARY KEY, basic INTEGER, preferred INTEGER
    )`)
    expect(await componentExtendedPromotionalColumn.checkIfAdded(db)).toBe(
      false,
    )
    await componentExtendedPromotionalColumn.execute(db)
    expect(await componentExtendedPromotionalColumn.checkIfAdded(db)).toBe(true)

    database.exec(`INSERT INTO components VALUES
      (1002, 1, 0), (1026, 0, 0), (1034, 0, 1), (9999, 1, 1), (8888, 0, NULL)
    `)
    expect(
      database
        .query(
          "SELECT lcsc FROM components WHERE is_extended_promotional = 1 ORDER BY lcsc",
        )
        .all(),
    ).toEqual([{ lcsc: 1034 }, { lcsc: 9999 }])
    expect(
      database
        .query(
          "SELECT is_extended_promotional FROM components WHERE lcsc = 8888",
        )
        .get(),
    ).toEqual({ is_extended_promotional: null })

    // A status change must update the alias without a separate backfill.
    database.exec("UPDATE components SET preferred = 0 WHERE lcsc = 1034")
    expect(
      database
        .query(
          "SELECT is_extended_promotional FROM components WHERE lcsc = 1034",
        )
        .get(),
    ).toEqual({ is_extended_promotional: 0 })
    expect(
      database
        .query(
          "SELECT name FROM pragma_index_info('idx_components_is_extended_promotional')",
        )
        .all(),
    ).toEqual([{ name: "is_extended_promotional" }])
  } finally {
    await db.destroy()
  }
})
