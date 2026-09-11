import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { Kysely, sql } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { componentExtendedPromotionalColumn } from "lib/db/optimizations/component-extended-promotional-column"
import { componentExtendedPromotionalIndex } from "lib/db/optimizations/component-extended-promotional-index"

describe("componentExtendedPromotionalColumn optimization", () => {
  test("adds generated column and evaluates promotional metadata correctly", async () => {
    const database = new Database(":memory:")
    const db = new Kysely<any>({
      dialect: new BunSqliteDialect({ database }),
    })

    try {
      // Create initial components table without is_extended_promotional
      await sql`
        CREATE TABLE components (
          lcsc INTEGER PRIMARY KEY,
          mfr TEXT,
          description TEXT,
          stock INTEGER,
          price TEXT,
          extra TEXT
        )
      `.execute(db)

      // Before optimization: checkIfAdded should return false (even on empty table)
      const beforeAdded = await componentExtendedPromotionalColumn.checkIfAdded(db)
      expect(beforeAdded).toBe(false)

      // Apply optimization
      await componentExtendedPromotionalColumn.execute(db)

      // After optimization: checkIfAdded should return true
      const afterAdded = await componentExtendedPromotionalColumn.checkIfAdded(db)
      expect(afterAdded).toBe(true)

      // Test inserting various rows and verifying generated column value
      const testCases = [
        { lcsc: 1, extra: JSON.stringify({ library_type: "promotional" }), expected: 1 },
        { lcsc: 2, extra: JSON.stringify({ library_type: "expand_promotional" }), expected: 1 },
        { lcsc: 3, extra: JSON.stringify({ library_type: "extended_promotional" }), expected: 1 },
        { lcsc: 4, extra: JSON.stringify({ is_extended_promotional: 1 }), expected: 1 },
        { lcsc: 5, extra: JSON.stringify({ is_extended_promotional: "true" }), expected: 1 },
        { lcsc: 6, extra: JSON.stringify({ promotional: 1 }), expected: 1 },
        { lcsc: 7, extra: JSON.stringify({ promotional: "true" }), expected: 1 },
        { lcsc: 8, extra: JSON.stringify({ library_type: "base" }), expected: 0 },
        { lcsc: 9, extra: JSON.stringify({ library_type: "expand" }), expected: 0 },
        { lcsc: 10, extra: null, expected: 0 },
        { lcsc: 11, extra: "{invalid_json", expected: 0 },
        { lcsc: 12, extra: JSON.stringify({ title: "Regular resistor" }), expected: 0 },
      ]

      for (const tc of testCases) {
        await sql`
          INSERT INTO components (lcsc, mfr, description, stock, price, extra)
          VALUES (${tc.lcsc}, 'MFR', 'Desc', 100, '1:1.0', ${tc.extra})
        `.execute(db)
      }

      const rows = (await sql<any>`
        SELECT lcsc, is_extended_promotional FROM components ORDER BY lcsc
      `.execute(db)).rows

      for (let i = 0; i < testCases.length; i++) {
        expect(rows[i].is_extended_promotional).toBe(testCases[i].expected)
      }
    } finally {
      await db.destroy()
    }
  })

  test("componentExtendedPromotionalIndex checks and executes properly", async () => {
    const database = new Database(":memory:")
    const db = new Kysely<any>({
      dialect: new BunSqliteDialect({ database }),
    })

    try {
      await sql`
        CREATE TABLE components (
          lcsc INTEGER PRIMARY KEY,
          is_extended_promotional BOOLEAN
        )
      `.execute(db)

      const beforeIndex = await componentExtendedPromotionalIndex.checkIfAdded(db)
      expect(beforeIndex).toBe(false)

      await componentExtendedPromotionalIndex.execute(db)

      const afterIndex = await componentExtendedPromotionalIndex.checkIfAdded(db)
      expect(afterIndex).toBe(true)
    } finally {
      await db.destroy()
    }
  })
})
