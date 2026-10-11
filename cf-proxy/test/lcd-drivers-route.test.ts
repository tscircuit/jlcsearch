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

          if (
            compiledQuery.sql.includes('select "mfr", "description", "extra"')
          ) {
            return {
              rows: [
                {
                  mfr: "HT1621B",
                  description: "32x4 bit LCD driver",
                  extra:
                    '{"attributes":{"Display Configurations(bit)":"32x4 bit"}}',
                },
                {
                  mfr: "HT1622",
                  description: "32x8 bit LCD driver",
                  extra:
                    '{"attributes":{"Display Configurations(bit)":"32x8 bit"}}',
                },
              ],
            }
          }

          return {
            rows: [
              {
                lcsc: 7873,
                mfr: "HT1621B",
                package: "SSOP-48-300mil",
                description: "LCD driver",
                stock: 18416,
                price: "1-9:0.464285714,10-:0.4",
                basic: 0,
                preferred: 1,
                extra:
                  '{"attributes":{"Display Configurations":"32x4 bit","Interface":"Serial"}}',
              },
              {
                lcsc: 46302,
                mfr: "HT1622",
                package: "LQFP-64(7x7)",
                description: "LCD driver",
                stock: 4541,
                price: '[{"qFrom":1,"price":0.901428571}]',
                basic: 0,
                preferred: 1,
                extra:
                  '{"attributes":{"Display Configurations(bit)":"32x8 bit"}}',
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
        max_resolution: "32x4",
      })

      expect(result).toEqual({
        tableName: "lcd_driver",
        filterOptions: {
          package: ["SSOP-48-300mil"],
          max_resolution: ["32x4", "32x8"],
        },
        data: {
          lcd_drivers: [
            {
              lcsc: 7873,
              mfr: "HT1621B",
              package: "SSOP-48-300mil",
              max_resolution: "32x4",
              description: "LCD driver",
              is_basic: false,
              is_preferred: true,
              is_extended_promotional: true,
              stock: 18416,
              price1: 0.464285714,
              attributes:
                '{"Display Configurations":"32x4 bit","Interface":"Serial"}',
            },
          ],
        },
      })

      const partsQuery = compiledQueries.find((query) =>
        query.sql.includes('select "lcsc"'),
      )
      expect(partsQuery?.sql).toContain('"subcategory" = ?')
      expect(partsQuery?.sql).toContain('"package" = ?')
      expect(partsQuery?.sql).toContain('"preferred" = ?')
      expect(partsQuery?.parameters).toEqual([
        0,
        "LCD Drivers",
        "SSOP-48-300mil",
        1,
      ])
    } finally {
      await db.destroy()
    }
  })
})
