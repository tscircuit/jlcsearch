import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { componentExtendedPromotionalColumn } from "lib/db/optimizations/component-extended-promotional-column"

test("componentExtendedPromotionalColumn adds column and index to components table", async () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE components (
      lcsc INTEGER PRIMARY KEY,
      category_id INTEGER,
      mfr TEXT,
      description TEXT,
      stock INTEGER DEFAULT 0,
      basic INTEGER DEFAULT 0
    );
    INSERT INTO components (lcsc, category_id, mfr, description, stock, basic)
    VALUES (1001, 1, 'Microchip', 'MCU Test', 100, 0);
  `)

  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    const beforeAdded =
      await componentExtendedPromotionalColumn.checkIfAdded(db)
    expect(beforeAdded).toBe(false)

    await componentExtendedPromotionalColumn.execute(db)

    const afterAdded = await componentExtendedPromotionalColumn.checkIfAdded(db)
    expect(afterAdded).toBe(true)

    const index = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_components_is_extended_promotional'",
      )
      .get()
    expect(index).not.toBeNull()

    // Verify filterable query works
    database.exec(`
      UPDATE components SET is_extended_promotional = 1 WHERE lcsc = 1001;
    `)
    const rows: any = database
      .query(
        "SELECT lcsc, is_extended_promotional FROM components WHERE is_extended_promotional = 1",
      )
      .all()
    expect(rows.length).toBe(1)
    expect(rows[0].lcsc).toBe(1001)
  } finally {
    await db.destroy()
  }
})
