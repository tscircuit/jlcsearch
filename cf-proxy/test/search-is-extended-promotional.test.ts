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

const createDb = () => {
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

  return { db, compiledQueries }
}

describe("searchIndex is_extended_promotional", () => {
  it("selects is_extended_promotional in every result row", async () => {
    const { db, compiledQueries } = createDb()

    try {
      await searchIndex(db, {})

      const query = compiledQueries[0]
      expect(query.sql).toContain("search_index.is_extended_promotional")
    } finally {
      await db.destroy()
    }
  })

  it("applies no extended filter when the param is absent", async () => {
    const { db, compiledQueries } = createDb()

    try {
      await searchIndex(db, {})

      const query = compiledQueries[0]
      expect(query.sql).not.toMatch(/is_extended_promotional\s*=\s*1/)
      expect(query.sql).toContain("search_index.is_extended_promotional")
    } finally {
      await db.destroy()
    }
  })

  it("filters to extended promotional parts when requested", async () => {
    const { db, compiledQueries } = createDb()

    try {
      await searchIndex(db, { is_extended_promotional: "true" })

      const query = compiledQueries[0]
      expect(query.sql).toContain("search_index.is_extended_promotional = 1")
      expect(query.sql).toContain("search_index.is_extended_promotional")
    } finally {
      await db.destroy()
    }
  })
})
