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
import { searchIndex } from "../src/search"
import { queryComponentCatalog } from "../src/components"
import type { DB } from "../src/db/types"

const createDb = (compiledQueries: CompiledQuery[]) => {
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
              description: "Inductor",
              stock: 1000,
              price: "1-9:0.1",
              price1: 0.1,
              basic: 0,
              preferred: 1,
              is_extended_promotional: 1,
              category: "Inductors",
              subcategory: "Inductors",
            },
          ],
        }
      },
      streamQuery: async function* () {},
    }) as DatabaseConnection

  return new Kysely<DB>({
    dialect: {
      createAdapter: () => new SqliteAdapter(),
      createDriver: () => driver,
      createIntrospector: (database) => new SqliteIntrospector(database),
      createQueryCompiler: () => new SqliteQueryCompiler(),
    },
  })
}

describe("searchIndex", () => {
  it("selects is_extended_promotional and filters when the param is set", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createDb(compiledQueries)

    try {
      const rows = await searchIndex(db, { is_extended_promotional: "true" })
      expect(rows).toHaveLength(1)
      expect(rows[0].is_extended_promotional).toBe(1)

      const query = compiledQueries.find((q) => q.sql.includes("search_index"))
      expect(query?.sql).toContain("search_index.is_extended_promotional")
      expect(query?.sql).toContain("search_index.is_extended_promotional = 1")
    } finally {
      await db.destroy()
    }
  })

  it("does not filter on is_extended_promotional when unset", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createDb(compiledQueries)

    try {
      await searchIndex(db, {})
      const query = compiledQueries.find((q) => q.sql.includes("search_index"))
      expect(query?.sql).not.toContain(
        "search_index.is_extended_promotional = 1",
      )
    } finally {
      await db.destroy()
    }
  })
})

describe("queryComponentCatalog", () => {
  it("forwards is_extended_promotional to the search index", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createDb(compiledQueries)

    try {
      const rows = await queryComponentCatalog(db, {
        is_extended_promotional: "true",
      })
      expect(rows).toHaveLength(1)

      const query = compiledQueries.find((q) => q.sql.includes("search_index"))
      expect(query?.sql).toContain("search_index.is_extended_promotional = 1")
    } finally {
      await db.destroy()
    }
  })
})
