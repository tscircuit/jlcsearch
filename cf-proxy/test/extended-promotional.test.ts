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
import { queryComponentCatalog } from "../src/components"
import type { DB } from "../src/db/types"
import { renderD1TablePage } from "../src/render"
import { searchIndex } from "../src/search"
import { createSelf, createTestEnv } from "./test-env"

const createMockDb = (compiledQueries: CompiledQuery[]) => {
  const driver = new DummyDriver()
  driver.acquireConnection = async () =>
    ({
      executeQuery: async (compiledQuery: CompiledQuery) => {
        compiledQueries.push(compiledQuery)
        return {
          rows: [
            {
              lcsc: 1002,
              mfr: "PART-EXT-PROMO",
              package: "SOT-23",
              description: "Ext Promo part",
              stock: 200,
              price: "1:0.2",
              price1: 0.2,
              basic: 0,
              preferred: 1,
              is_extended_promotional: 1,
              category: "Resistors",
              subcategory: "Chip Resistor",
              manufacturer_name: "Mfr2",
              title: "Title2",
              mpn: "PART-EXT-PROMO",
              attributes: "{}",
              search_text: "part-ext-promo",
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

describe("is_extended_promotional catalog and search filtering", () => {
  it("filters searchIndex results by is_extended_promotional=true", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createMockDb(compiledQueries)
    try {
      const results = await searchIndex(db, { is_extended_promotional: "true" })
      expect(results).toHaveLength(1)
      expect(results[0].is_extended_promotional).toBe(1)
      const query = compiledQueries[0]
      expect(query.sql).toContain("search_index.is_extended_promotional = 1")
    } finally {
      await db.destroy()
    }
  })

  it("does not filter searchIndex results when is_extended_promotional is false or unset", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createMockDb(compiledQueries)
    try {
      await searchIndex(db, { is_extended_promotional: "false" })
      const query = compiledQueries[0]
      expect(query.sql).not.toContain(
        "search_index.is_extended_promotional = 1",
      )
    } finally {
      await db.destroy()
    }
  })

  it("filters queryComponentCatalog results by is_extended_promotional=true", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createMockDb(compiledQueries)
    try {
      const results = await queryComponentCatalog(db, {
        is_extended_promotional: "true",
      })
      expect(results).toHaveLength(1)
      expect(results[0].is_extended_promotional).toBe(1)
      const query = compiledQueries[0]
      expect(query.sql).toContain("search_index.is_extended_promotional = 1")
    } finally {
      await db.destroy()
    }
  })

  it("does not filter queryComponentCatalog results when is_extended_promotional is false or unset", async () => {
    const compiledQueries: CompiledQuery[] = []
    const db = createMockDb(compiledQueries)
    try {
      await queryComponentCatalog(db, {
        is_extended_promotional: "false",
      })
      const query = compiledQueries[0]
      expect(query.sql).not.toContain(
        "search_index.is_extended_promotional = 1",
      )
    } finally {
      await db.destroy()
    }
  })

  it("renders the Extended Promotional checkbox in components filter", () => {
    const htmlUnchecked = renderD1TablePage(
      "/components/list",
      { components: [] },
      {},
    )
    expect(htmlUnchecked).toContain('name="is_extended_promotional"')
    expect(htmlUnchecked).not.toContain(
      'name="is_extended_promotional" value="true" checked',
    )

    const htmlChecked = renderD1TablePage(
      "/components/list",
      { components: [] },
      { is_extended_promotional: "true" },
    )
    expect(htmlChecked).toContain(
      'name="is_extended_promotional" value="true" checked',
    )
  })

  it("renders Extended Promotional column in components table", () => {
    const html = renderD1TablePage(
      "/components/list",
      {
        components: [
          {
            lcsc: 1002,
            mfr: "PART-EXT-PROMO",
            is_extended_promotional: true,
          },
        ],
      },
      {},
    )
    expect(html).toContain("Extended Promotional")
  })

  it("handles worker /components/list with is_extended_promotional filter", async () => {
    const env = createTestEnv()
    env.USE_D1 = "true"
    let capturedSql = ""
    let capturedParams: any[] = []

    env.DB = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => {
          capturedSql = sql
          capturedParams = params
          return {
            all: async () => ({
              results: [
                {
                  lcsc: 1002,
                  mfr: "PART-EXT-PROMO",
                  package: "SOT-23",
                  basic: 0,
                  preferred: 1,
                  is_extended_promotional: 1,
                  stock: 100,
                  price: "1:0.2",
                },
              ],
              meta: { changes: 0 },
            }),
            raw: async () => [],
          }
        },
      }),
    } as unknown as D1Database

    const self = createSelf(env)
    const response = await self.fetch(
      "https://example.com/components/list?json=true&is_extended_promotional=true",
      { headers: { accept: "application/json" } },
    )

    expect(response.status).toBe(200)
    expect(capturedSql).toContain("search_index.is_extended_promotional = 1")
    const json = (await response.json()) as any
    expect(json.components).toHaveLength(1)
    expect(json.components[0].is_extended_promotional).toBe(true)
    expect(json.components[0].is_basic).toBe(false)
    expect(json.components[0].is_preferred).toBe(true)
  })

  it("handles worker /api/search with is_extended_promotional filter", async () => {
    const env = createTestEnv()
    env.USE_D1 = "true"
    let capturedSql = ""
    let capturedParams: any[] = []

    env.DB = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => {
          capturedSql = sql
          capturedParams = params
          return {
            all: async () => ({
              results: [
                {
                  lcsc: 1002,
                  mfr: "PART-EXT-PROMO",
                  package: "SOT-23",
                  basic: 0,
                  preferred: 1,
                  is_extended_promotional: 1,
                  stock: 100,
                  price: "1:0.2",
                },
              ],
              meta: { changes: 0 },
            }),
            raw: async () => [],
          }
        },
      }),
    } as unknown as D1Database

    const self = createSelf(env)
    const response = await self.fetch(
      "https://example.com/api/search?is_extended_promotional=true",
      { headers: { accept: "application/json" } },
    )

    expect(response.status).toBe(200)
    expect(capturedSql).toContain("search_index.is_extended_promotional = 1")
    const json = (await response.json()) as any
    expect(json.components).toHaveLength(1)
    expect(json.components[0].is_extended_promotional).toBe(true)
  })
})
