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

describe.each([
  ["/arm_processors/list", "arm_processors", "ARM%"],
  ["/risc_v_processors/list", "risc_v_processors", "RISC-V"],
] as const)("%s", (pathname, responseKey, coreFilter) => {
  it("filters processors by manufacturer and returns manufacturer options", async () => {
    const compiledQueries: CompiledQuery[] = []
    const driver = new DummyDriver()

    driver.acquireConnection = async () =>
      ({
        executeQuery: async (compiledQuery: CompiledQuery) => {
          compiledQueries.push(compiledQuery)

          if (
            compiledQuery.sql.startsWith("select distinct") &&
            compiledQuery.sql.includes('as "manufacturer"')
          ) {
            return {
              rows: [
                { manufacturer: "NXP Semiconductors" },
                { manufacturer: "STMicroelectronics" },
              ],
            }
          }

          if (
            compiledQuery.sql.startsWith(
              'select distinct "microcontroller"."package"',
            )
          ) {
            return { rows: [{ package: "LQFP-64" }] }
          }

          return {
            rows: [
              {
                lcsc: 123,
                mfr: "STM32F401RCT6",
                manufacturer: "STMicroelectronics",
                package: "LQFP-64",
                cpu_core: coreFilter === "ARM%" ? "ARM Cortex-M4" : "RISC-V",
                cpu_speed_hz: 84_000_000,
                flash_size_bytes: 262_144,
                ram_size_bytes: 65_536,
                eeprom_size_bytes: null,
                gpio_count: 51,
                has_uart: 1,
                has_i2c: 1,
                has_spi: 1,
                has_can: 0,
                has_usb: 1,
                stock: 500,
                price1: 3.25,
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
      const handler = getD1Handler(pathname)
      expect(handler).not.toBeNull()

      const result = await handler!(db, {
        manufacturer: "STMicroelectronics",
      })

      expect(result.filterOptions?.manufacturer).toEqual([
        "NXP Semiconductors",
        "STMicroelectronics",
      ])
      expect(result.data[responseKey]).toEqual([
        expect.objectContaining({
          lcsc: 123,
          manufacturer: "STMicroelectronics",
          package: "LQFP-64",
        }),
      ])

      const partsQuery = compiledQueries.find(
        (query) =>
          query.sql.includes('select "microcontroller".*') &&
          query.sql.includes('as "manufacturer"'),
      )
      expect(partsQuery?.sql).toContain(
        'left join "component_catalog" on "component_catalog"."lcsc" = "microcontroller"."lcsc"',
      )
      expect(partsQuery?.sql).toContain('"microcontroller"."cpu_core"')
      expect(partsQuery?.sql).toContain("json_extract")
      expect(partsQuery?.parameters).toContain("STMicroelectronics")
    } finally {
      await db.destroy()
    }
  })
})
