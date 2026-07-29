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
import {
  createDisplayDriverMaxResolutionResolver,
  getDisplayDriverMaxResolution,
} from "../src/display-driver-resolution"
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

  it("derives the largest catalog configuration and known TFT maxima", () => {
    expect(
      getDisplayDriverMaxResolution({
        mfr: "HT1621B",
        description: "SSOP-48-300mil LCD driver",
        extra:
          '{"attributes":{"Display Configurations(bit)":"20x4 bit, 16x8 bit"}}',
      }),
    ).toBe("16x8")
    expect(
      getDisplayDriverMaxResolution({
        mfr: "HT1622",
        description: "32x8 bit LQFP-64(7x7) LCD driver",
        extra: "{}",
      }),
    ).toBe("32x8")
    expect(
      getDisplayDriverMaxResolution({
        mfr: "SSD1963QL9",
        description: "LQFP-128(14x14) LCD driver",
        extra: "{}",
      }),
    ).toBe("864x480")
    expect(
      getDisplayDriverMaxResolution({
        mfr: "LT7689",
        description: "QFN-96-EP(10x10) LCD driver",
        extra: "{}",
      }),
    ).toBe("1280x1024")

    const resolveFromRelatedCatalogRows =
      createDisplayDriverMaxResolutionResolver([
        {
          mfr: "HT1622-LQFP64",
          extra: '{"attributes":{"Display Configurations(bit)":"32x8 bit"}}',
        },
      ])
    expect(
      resolveFromRelatedCatalogRows({
        mfr: "HT1622",
        description: "LQFP-64(7x7) LCD driver",
        extra: "{}",
      }),
    ).toBe("32x8")
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

          if (
            compiledQuery.sql.includes('select "mfr", "description", "extra"')
          ) {
            return {
              rows: [
                {
                  mfr: "SSD1963QL9",
                  description: "TFT LCD controller",
                  extra: "{}",
                },
              ],
            }
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
                extended_promotional: 1,
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
        max_resolution: "864x480",
      })

      expect(result.data.tft_display_drivers).toEqual([
        {
          lcsc: 15216,
          mfr: "SSD1963QL9",
          package: "LQFP-128(14x14)",
          driver_type: "Display Controller",
          catalog_type: "LCD Drivers",
          max_resolution: "864x480",
          description: "TFT LCD controller",
          is_basic: false,
          is_preferred: true,
          is_extended_promotional: true,
          stock: 604,
          price1: 5.845714286,
          attributes: '{"Interface":"8080/6800"}',
        },
      ])
      expect(result.filterOptions?.package).toEqual(["LQFP-128(14x14)"])
      expect(result.filterOptions?.max_resolution).toEqual(["864x480"])

      const partsQuery = compiledQueries.find((query) =>
        query.sql.includes('select "lcsc"'),
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
