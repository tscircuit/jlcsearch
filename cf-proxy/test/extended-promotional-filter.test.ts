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
import { getD1Handler, getD1RouteParams } from "../src/d1-routes"
import type { DB } from "../src/db/types"
import { renderD1TablePage } from "../src/render"
import { searchIndex } from "../src/search"

function createCapturingDb(rowsForQuery?: (q: CompiledQuery) => unknown[]): {
  db: Kysely<DB>
  compiledQueries: CompiledQuery[]
} {
  const compiledQueries: CompiledQuery[] = []
  const driver = new DummyDriver()
  driver.acquireConnection = async () =>
    ({
      executeQuery: async (compiledQuery: CompiledQuery) => {
        compiledQueries.push(compiledQuery)
        return { rows: rowsForQuery ? rowsForQuery(compiledQuery) : [] }
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

describe("is_basic and is_extended_promotional / is_preferred filters", () => {
  it("allows is_extended_promotional in route params across search, components, and derived tables", () => {
    expect(getD1RouteParams("/api/search")).toContain("is_extended_promotional")
    expect(getD1RouteParams("/components/list")).toContain(
      "is_extended_promotional",
    )
    expect(getD1RouteParams("/lcd_drivers/list")).toContain(
      "is_extended_promotional",
    )
    expect(getD1RouteParams("/tft_display_drivers/list")).toContain(
      "is_extended_promotional",
    )
    expect(getD1RouteParams("/resistors/list")).toContain(
      "is_extended_promotional",
    )
  })

  it("supports is_extended_promotional and OR-combines when both is_basic and is_extended_promotional are selected in searchIndex", async () => {
    const { db, compiledQueries } = createCapturingDb()
    try {
      await searchIndex(db, { is_extended_promotional: "true" })
      expect(compiledQueries.at(-1)?.sql).toContain(
        "search_index.preferred = 1",
      )

      await searchIndex(db, {
        is_basic: "true",
        is_extended_promotional: "true",
      })
      const combinedSql = compiledQueries.at(-1)?.sql ?? ""
      expect(combinedSql).toContain(
        "(search_index.basic = 1 OR search_index.preferred = 1)",
      )
      expect(combinedSql).not.toContain(
        "search_index.basic = 1 AND search_index.preferred = 1",
      )
    } finally {
      await db.destroy()
    }
  })

  it("supports is_extended_promotional and OR-combines both flags on derived table routes", async () => {
    const { db, compiledQueries } = createCapturingDb()
    try {
      const handler = getD1Handler("/resistors/list", {
        includeFilterOptions: false,
      })
      expect(handler).not.toBeNull()

      await handler!(db, { is_extended_promotional: "true" })
      expect(compiledQueries.at(-1)?.sql).toContain('"is_preferred" = ?')
      expect(compiledQueries.at(-1)?.parameters).toEqual([1])

      await handler!(db, {
        is_basic: "true",
        is_extended_promotional: "true",
        package: "0402",
      })
      const combined = compiledQueries.at(-1)!
      expect(combined.sql).toContain('("is_basic" = 1 OR "is_preferred" = 1)')
      expect(combined.sql).toContain('"package" = ?')
      expect(combined.parameters).toEqual(["0402"])
    } finally {
      await db.destroy()
    }
  })

  it("OR-combines basic and preferred on /lcd_drivers/list when both checkboxes are selected", async () => {
    const { db, compiledQueries } = createCapturingDb()
    try {
      const handler = getD1Handler("/lcd_drivers/list")
      await handler!(db, {
        is_basic: "true",
        is_extended_promotional: "true",
      })
      const partsQuery = compiledQueries.find((q) =>
        q.sql.includes('select "lcsc"'),
      )
      expect(partsQuery?.sql).toContain('("basic" = ? or "preferred" = ?)')
    } finally {
      await db.destroy()
    }
  })

  it("marks checkboxes and selects when is_extended_promotional=true is passed in HTML rendering", () => {
    const componentsHtml = renderD1TablePage(
      "/components/list",
      { components: [] },
      { is_basic: "true", is_extended_promotional: "true" },
      "https://jlcsearch.tscircuit.com/components/list?is_basic=true&is_extended_promotional=true",
    )
    expect(componentsHtml).toContain('name="is_basic" value="true" checked')
    expect(componentsHtml).toContain('name="is_preferred" value="true" checked')

    const resistorsHtml = renderD1TablePage(
      "/resistors/list",
      { resistors: [] },
      { is_extended_promotional: "true" },
      "https://jlcsearch.tscircuit.com/resistors/list?is_extended_promotional=true",
    )
    expect(resistorsHtml).toContain(
      '<select name="is_preferred"><option value="">All</option><option value="true" selected>Yes</option>',
    )
  })
})
