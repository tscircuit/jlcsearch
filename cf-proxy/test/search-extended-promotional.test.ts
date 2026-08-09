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
import type { DB } from "../src/db/types"
import { searchIndex } from "../src/search"

const createCapturingDb = (compiledQueries: CompiledQuery[]) => {
  const driver = new DummyDriver()

  driver.acquireConnection = async () =>
    ({
      executeQuery: async (compiledQuery: CompiledQuery) => {
        compiledQueries.push(compiledQuery)
        return { rows: [] }
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

describe("searchIndex is_extended_promotional filter", () => {
  it("restricts to preferred extended parts when enabled", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createCapturingDb(compiledQueries)

    try {
      await searchIndex(db, { is_extended_promotional: "true" })

      const sql = compiledQueries.map((q) => q.sql).join("\n")
      expect(sql).toContain(
        "search_index.preferred = 1 AND search_index.basic = 0",
      )
    } finally {
      await db.destroy()
    }
  })

  it("also accepts the '1' truthy value", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createCapturingDb(compiledQueries)

    try {
      await searchIndex(db, { is_extended_promotional: "1" })

      const sql = compiledQueries.map((q) => q.sql).join("\n")
      expect(sql).toContain(
        "search_index.preferred = 1 AND search_index.basic = 0",
      )
    } finally {
      await db.destroy()
    }
  })

  it("does not constrain basic status when the filter is absent", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createCapturingDb(compiledQueries)

    try {
      await searchIndex(db, {})

      const sql = compiledQueries.map((q) => q.sql).join("\n")
      expect(sql).not.toContain("search_index.basic = 0")
    } finally {
      await db.destroy()
    }
  })
})
