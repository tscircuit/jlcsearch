import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { componentExtendedPromotionalColumn } from "lib/db/optimizations/component-extended-promotional-column"

test("componentExtendedPromotionalColumn adds generated column and index", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    database.exec(`
      CREATE TABLE components (
        lcsc INTEGER PRIMARY KEY,
        mfr TEXT,
        stock INTEGER,
        basic INTEGER,
        preferred INTEGER
      );
      INSERT INTO components (lcsc, mfr, stock, basic, preferred) VALUES
        (1, 'PART-EXT-PROMO', 100, 0, 1),
        (2, 'PART-BASIC-PREF', 50, 1, 1),
        (3, 'PART-EXT-REGULAR', 20, 0, 0),
        (4, 'PART-BASIC-REGULAR', 10, 1, 0);
    `)

    expect(await componentExtendedPromotionalColumn.checkIfAdded(db)).toBe(
      false,
    )

    await componentExtendedPromotionalColumn.execute(db)

    expect(await componentExtendedPromotionalColumn.checkIfAdded(db)).toBe(true)

    const rows = database
      .query(
        "SELECT lcsc, is_extended_promotional FROM components ORDER BY lcsc ASC",
      )
      .all() as Array<{ lcsc: number; is_extended_promotional: number }>

    expect(rows).toEqual([
      { lcsc: 1, is_extended_promotional: 1 },
      { lcsc: 2, is_extended_promotional: 0 },
      { lcsc: 3, is_extended_promotional: 0 },
      { lcsc: 4, is_extended_promotional: 0 },
    ])

    const index = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_components_is_extended_promotional'",
      )
      .get()

    expect(index).not.toBeNull()
  } finally {
    await db.destroy()
  }
})

test("componentExtendedPromotionalColumn works on empty table", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    database.exec(`
      CREATE TABLE components (
        lcsc INTEGER PRIMARY KEY,
        mfr TEXT,
        stock INTEGER,
        basic INTEGER,
        preferred INTEGER
      );
    `)

    expect(await componentExtendedPromotionalColumn.checkIfAdded(db)).toBe(
      false,
    )
    await componentExtendedPromotionalColumn.execute(db)
    expect(await componentExtendedPromotionalColumn.checkIfAdded(db)).toBe(true)
  } finally {
    await db.destroy()
  }
})
