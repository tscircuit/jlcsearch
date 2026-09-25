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

const createDb = (compiledQueries: CompiledQuery[]) => {
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
      createIntrospector: (db) => new SqliteIntrospector(db),
      createQueryCompiler: () => new SqliteQueryCompiler(),
    },
  })
}

describe("searchIndex extended promotional filter", () => {
  it("filters on search_index.is_extended_promotional when the param is true", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createDb(compiledQueries)

    await searchIndex(db, { is_extended_promotional: "true" })

    expect(compiledQueries).toHaveLength(1)
    expect(compiledQueries[0].sql).toContain(
      "search_index.is_extended_promotional = 1",
    )
  })

  it("accepts is_extended_promotional=1 as an alias for true", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createDb(compiledQueries)

    await searchIndex(db, { is_extended_promotional: "1" })

    expect(compiledQueries[0].sql).toContain(
      "search_index.is_extended_promotional = 1",
    )
  })

  it("does not filter when the param is unset", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createDb(compiledQueries)

    await searchIndex(db, {})

    expect(compiledQueries[0].sql).not.toContain("is_extended_promotional = 1")
  })

  it("selects the is_extended_promotional column in results", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createDb(compiledQueries)

    await searchIndex(db, {})

    expect(compiledQueries[0].sql).toContain(
      "search_index.is_extended_promotional",
    )
  })
})
