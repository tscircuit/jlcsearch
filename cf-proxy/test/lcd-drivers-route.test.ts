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

describe("LCD driver route", () => {
  it("queries LCD driver chips and applies catalog filters", async () => {
    const compiledQueries: CompiledQuery[] = []
    const driver = new DummyDriver()

    driver.acquireConnection = async () =>
      ({
        executeQuery: async (compiledQuery: CompiledQuery) => {
          compiledQueries.push(compiledQuery)

          if (compiledQuery.sql.includes('select distinct "package"')) {
            return { rows: [{ package: "SSOP-48-300mil" }] }
          }

          return {
            rows: [
              {
                lcsc: 7873,
                mfr: "HT1621B",
                package: "SSOP-48-300mil",
                description: "LCD driver",
                stock: 18416,
                price: '[{"qFrom":1,"price":0.464285714}]',
                basic: 0,
                preferred: 1,
                extra: '{"attributes":{"Interface":"Serial"}}',
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
      const handler = getD1Handler("/lcd_drivers/list")
      expect(handler).not.toBeNull()

      const result = await handler!(db, {
        package: "SSOP-48-300mil",
        is_preferred: "true",
      })

      expect(result).toEqual({
        tableName: "lcd_driver",
        filterOptions: { package: ["SSOP-48-300mil"] },
        data: {
          lcd_drivers: [
            {
              lcsc: 7873,
              mfr: "HT1621B",
              package: "SSOP-48-300mil",
              description: "LCD driver",
              is_basic: false,
              is_preferred: true,
              stock: 18416,
              price1: 0.464285714,
              attributes: '{"Interface":"Serial"}',
            },
          ],
        },
      })

      const partsQuery = compiledQueries.find(
        (query) => !query.sql.includes('select distinct "package"'),
      )
      expect(partsQuery?.sql).toContain('"subcategory" = ?')
      expect(partsQuery?.sql).toContain('"package" = ?')
      expect(partsQuery?.sql).toContain('"preferred" = ?')
      expect(partsQuery?.parameters).toEqual([
        0,
        "LCD Drivers",
        "SSOP-48-300mil",
        1,
        100,
      ])
    } finally {
      await db.destroy()
    }
  })
})
