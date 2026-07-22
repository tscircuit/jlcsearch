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
import { getTftDisplayDriverFamily } from "../src/tft-display-drivers"

describe("TFT display driver route", () => {
  it("classifies TFT support families without including segment LCD drivers", () => {
    expect(getTftDisplayDriverFamily("SSD1963QL9")?.label).toBe(
      "Display Controller",
    )
    expect(getTftDisplayDriverFamily("TPS65132B5YFFR")?.label).toBe(
      "Bias / Power",
    )
    expect(getTftDisplayDriverFamily("BUF16821AIPWPR")?.label).toBe(
      "Gamma Buffer",
    )
    expect(getTftDisplayDriverFamily("AP3041MTR-G1")?.label).toBe(
      "Backlight Driver",
    )
    expect(getTftDisplayDriverFamily("HT1621B")).toBeUndefined()
  })

  it("selects and labels TFT controller families", async () => {
    const compiledQueries: CompiledQuery[] = []
    const driver = new DummyDriver()

    driver.acquireConnection = async () =>
      ({
        executeQuery: async (compiledQuery: CompiledQuery) => {
          compiledQueries.push(compiledQuery)

          if (compiledQuery.sql.includes('select distinct "package"')) {
            return { rows: [{ package: "LQFP-128(14x14)" }] }
          }

          return {
            rows: [
              {
                lcsc: 15216,
                mfr: "SSD1963QL9",
                package: "LQFP-128(14x14)",
                description: "TFT LCD controller",
                stock: 604,
                price: '[{"qFrom":1,"price":5.845714286}]',
                basic: 0,
                preferred: 1,
                subcategory: "LCD Drivers",
                extra: '{"attributes":{"Interface":"8080/6800"}}',
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
      const handler = getD1Handler("/tft_display_drivers/list")
      expect(handler).not.toBeNull()

      const result = await handler!(db, {
        driver_type: "controller",
        package: "LQFP-128(14x14)",
        is_preferred: "true",
      })

      expect(result.data.tft_display_drivers).toEqual([
        {
          lcsc: 15216,
          mfr: "SSD1963QL9",
          package: "LQFP-128(14x14)",
          driver_type: "Display Controller",
          catalog_type: "LCD Drivers",
          description: "TFT LCD controller",
          is_basic: false,
          is_preferred: true,
          stock: 604,
          price1: 5.845714286,
          attributes: '{"Interface":"8080/6800"}',
        },
      ])
      expect(result.filterOptions?.package).toEqual(["LQFP-128(14x14)"])

      const partsQuery = compiledQueries.find(
        (query) => !query.sql.includes('select distinct "package"'),
      )
      expect(partsQuery?.sql).toContain('"subcategory" in (?, ?)')
      expect(partsQuery?.sql).toContain('"mfr" like ?')
      expect(partsQuery?.sql).toContain('"package" = ?')
      expect(partsQuery?.sql).toContain('"preferred" = ?')
      expect(partsQuery?.parameters).toContain("SSD1963%")
      expect(partsQuery?.parameters).not.toContain("TPS651%")
    } finally {
      await db.destroy()
    }
  })
})
