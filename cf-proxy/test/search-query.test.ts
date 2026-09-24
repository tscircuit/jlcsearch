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
import { buildSearchTokenGroups } from "../src/search-query"
import { searchIndex } from "../src/search"

describe("buildSearchTokenGroups", () => {
  it("maps barrel jack wording to DC power connector catalog terms", () => {
    expect(buildSearchTokenGroups("barrel jack")).toEqual([
      ["dc"],
      ["power"],
      ["receptacle"],
    ])
  })

  it("drops nominal voltage tokens for barrel jack searches", () => {
    expect(buildSearchTokenGroups("5v barrel jack")).toEqual([
      ["dc"],
      ["power"],
      ["receptacle"],
    ])
  })

  it("preserves non-barrel-jack terms", () => {
    expect(buildSearchTokenGroups("2.1mm barrel jack")).toEqual([
      ["2"],
      ["1mm"],
      ["dc"],
      ["power"],
      ["receptacle"],
    ])
  })
})

describe("extended promotional search", () => {
  it("selects and returns the extended promotional field", async () => {
    const compiledQueries: CompiledQuery[] = []
    const driver = new DummyDriver()

    driver.acquireConnection = async () =>
      ({
        executeQuery: async (compiledQuery: CompiledQuery) => {
          compiledQueries.push(compiledQuery)
          if (compiledQuery.sql.includes("search_index_fts_meta")) {
            return { rows: [] }
          }
          return {
            rows: [
              {
                lcsc: 123,
                mfr: "TEST",
                package: "0603",
                description: "test",
                stock: 10,
                price: null,
                price1: 1,
                basic: 0,
                preferred: 1,
                extended_promotional: 1,
                category: "Resistors",
                subcategory: "Resistors",
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
      })

      expect(rows[0].extended_promotional).toBe(1)
      const query = compiledQueries.find((compiledQuery) =>
        compiledQuery.sql.includes("search_index.extended_promotional = 1"),
      )
      expect(query).toBeDefined()
      expect(query?.parameters).toEqual([100])
    } finally {
      await db.destroy()
    }
  })
})
