import {
  type CompiledQuery,
  type DatabaseConnection,
  DummyDriver,
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from "kysely"
import { describe, expect, it } from "vitest"
import type { DB } from "../src/db/types"
import { searchIndex } from "../src/search"

describe("searchIndex", () => {
  it("filters and labels extended promotional parts", async () => {
    const compiledQueries: CompiledQuery[] = []
    const driver = new DummyDriver()

    driver.acquireConnection = async () =>
      ({
        executeQuery: async (compiledQuery: CompiledQuery) => {
          compiledQueries.push(compiledQuery)
          return {
            rows: [
              {
                lcsc: 1034,
                mfr: "SDFL1608Q4R7KTF",
                package: "0603",
                description: "Multilayer inductor",
                stock: 80794,
                price: null,
                price1: 0.0125,
                basic: 0,
                preferred: 1,
                is_extended_promotional: 1,
                category: "Inductors",
                subcategory: "Multilayer Inductors",
              },
            ],
          }
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
      const rows = await searchIndex(db, {
        is_extended_promotional: "true",
        limit: "5",
      })

      expect(rows[0]?.is_extended_promotional).toBe(1)
      expect(compiledQueries).toHaveLength(1)
      expect(compiledQueries[0]?.sql).toContain(
        "search_index.preferred = 1 AND search_index.basic = 0",
      )
      expect(compiledQueries[0]?.sql).toContain(
        "END AS is_extended_promotional",
      )
      expect(compiledQueries[0]?.parameters).toEqual([5])
    } finally {
      await db.destroy()
    }
  })
})
