import {
  type CompiledQuery,
  type DatabaseConnection,
  DummyDriver,
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from "kysely"
import { describe, expect, it } from "vitest"
import { getD1Handler, getD1RouteParams } from "../src/d1-routes"
import type {
  Adc,
  BaseComponentRow,
  Capacitor,
  DB,
  Diode,
  Led,
  Microcontroller,
  Mosfet,
  Resistor,
  VoltageRegulator,
  WifiModule,
} from "../src/db/types"
import {
  BASE_COMPONENT_FILTERS,
  ROUTE_TO_TABLE,
  TABLE_CONFIGS,
} from "../src/handlers"

type AssertExtendsBase<T extends BaseComponentRow> = T

// Compile-time assertions that derived component table types extend BaseComponentRow
type _CheckDerivedTypes = [
  AssertExtendsBase<Resistor>,
  AssertExtendsBase<Capacitor>,
  AssertExtendsBase<Microcontroller>,
  AssertExtendsBase<Led>,
  AssertExtendsBase<Diode>,
  AssertExtendsBase<Mosfet>,
  AssertExtendsBase<Adc>,
  AssertExtendsBase<VoltageRegulator>,
  AssertExtendsBase<WifiModule>,
]

describe("Global BaseComponent filters and types across component routes", () => {
  it("exposes is_basic and is_preferred filters on every TABLE_CONFIGS entry and route", () => {
    const tableNames = Object.keys(TABLE_CONFIGS)
    expect(tableNames.length).toBeGreaterThan(40)

    for (const tableName of tableNames) {
      const config = TABLE_CONFIGS[tableName]
      expect(config.filters.is_basic).toEqual(BASE_COMPONENT_FILTERS.is_basic)
      expect(config.filters.is_preferred).toEqual(
        BASE_COMPONENT_FILTERS.is_preferred,
      )
    }

    for (const pathname of Object.keys(ROUTE_TO_TABLE)) {
      const params = getD1RouteParams(pathname)
      expect(params).not.toBeNull()
      expect(params).toContain("is_basic")
      expect(params).toContain("is_preferred")
    }
  })

  it.each([
    ["/resistors/list", "resistors"],
    ["/microcontrollers/list", "microcontrollers"],
    ["/leds/list", "leds"],
    ["/diodes/list", "diodes"],
    ["/mosfets/list", "mosfets"],
  ] as const)(
    "applies is_basic and is_preferred filters and normalizes booleans on %s",
    async (pathname, responseKey) => {
      const compiledQueries: CompiledQuery[] = []
      const driver = new DummyDriver()
      const row = {
        lcsc: 123456,
        mfr: "TEST-PART",
        description: "Test component",
        stock: 500,
        price1: 0.12,
        in_stock: 1,
        is_basic: 1,
        is_preferred: 0,
        attributes: "{}",
      }

      driver.acquireConnection = async () =>
        ({
          executeQuery: async (compiledQuery: CompiledQuery) => {
            compiledQueries.push(compiledQuery)
            return { rows: [row] }
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
        const handler = getD1Handler(pathname, { includeFilterOptions: false })
        expect(handler).not.toBeNull()

        const result = await handler!(db, {
          is_basic: "true",
          is_preferred: "false",
        })

        expect(compiledQueries).toHaveLength(1)
        expect(compiledQueries[0].sql).toContain('"is_basic" = ?')
        expect(compiledQueries[0].sql).toContain('"is_preferred" = ?')
        expect(compiledQueries[0].parameters).toEqual([1, 0])

        const items = result.data[responseKey] as Array<Record<string, unknown>>
        expect(items).toHaveLength(1)
        expect(items[0].is_basic).toBe(true)
        expect(items[0].is_preferred).toBe(false)
        expect(items[0].in_stock).toBe(true)
        expect(items[0].price1).toBe(0.12)
      } finally {
        await db.destroy()
      }
    },
  )
})
