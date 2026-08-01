import {
  DummyDriver,
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
} from "kysely"
import { describe, expect, it } from "vitest"
import { getD1Handler } from "../src/d1-routes"
import type { DB } from "../src/db/types"

describe("Photo Diodes route", () => {
  it("filters by whether the desired wavelength is in the detection range", async () => {
    const compiledQueries: CompiledQuery[] = []
    const driver = new DummyDriver()

    driver.acquireConnection = async () =>
      ({
        executeQuery: async (compiledQuery: CompiledQuery) => {
          compiledQueries.push(compiledQuery)
          return { rows: [] }
        },
        streamQuery: async function* () {},
      }) as DatabaseConnection

    const db = new Kysely<DB>({
      dialect: {
        createAdapter: () => new SqliteAdapter(),
        createDriver: () => driver,
        createIntrospector: (database) => new SqliteIntrospector(database),
        createQueryCompiler: () => new SqliteQueryCompiler(),
      },
    })

    try {
      const handler = getD1Handler("/photo_diodes/list")
      expect(handler).not.toBeNull()

      await handler!(db, { wavelength_min: "300" })

      const partsQuery = compiledQueries.find((query) =>
        query.sql.startsWith('SELECT * FROM "photo_diode"'),
      )
      expect(partsQuery?.sql).toContain('"spectral_range_min_nm" IS NOT NULL')
      expect(partsQuery?.sql).toContain('"spectral_range_max_nm" IS NOT NULL')
      expect(partsQuery?.sql).toContain('"spectral_range_min_nm" <= ?')
      expect(partsQuery?.sql).toContain('"spectral_range_max_nm" >= ?')
      expect(partsQuery?.sql).toContain('"peak_wavelength_nm" = ?')
      expect(partsQuery?.parameters).toEqual([300, 300, 300])
    } finally {
      await db.destroy()
    }
  })
})
