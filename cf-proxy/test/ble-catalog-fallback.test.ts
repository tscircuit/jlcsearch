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

interface FallbackCase {
  path: string
  missingTable: string
  responseKey: string
  catalogRow: Record<string, unknown>
  expectedMfr: string
}

const fallbackCases: FallbackCase[] = [
  {
    path: "/ble_modules/list",
    missingTable: "ble_module",
    responseKey: "ble_modules",
    catalogRow: {
      lcsc: 20539408,
      mfr: "VG6328A",
      package: "SMD,16x13.6mm",
      description: "BLE module",
      stock: 8848,
      price: '[{"qFrom":1,"price":0.938571429}]',
      basic: 0,
      preferred: 0,
      subcategory: "Bluetooth Modules",
      extra:
        '{"attributes":{"Bluetooth Version":"BLE 5.2","Antenna Type":"On-Board PCB Antenna","Support Interface":"UART;I2C"}}',
    },
    expectedMfr: "VG6328A",
  },
  {
    path: "/ble_chips/list",
    missingTable: "ble_chip",
    responseKey: "ble_chips",
    catalogRow: {
      lcsc: 77540,
      mfr: "NRF52832-QFAA-R",
      package: "QFN-48-EP(6x6)",
      description: "Bluetooth RF transceiver",
      stock: 19295,
      price: '[{"qFrom":1,"price":2.562857143}]',
      basic: 0,
      preferred: 0,
      subcategory: "RF Transceiver ICs",
      extra:
        '{"attributes":{"Applications":"Bluetooth","Bluetooth Version":"5.0","Interface":"I2C,SPI,UART"}}',
    },
    expectedMfr: "NRF52832-QFAA-R",
  },
]

describe("BLE catalog fallback", () => {
  for (const fallbackCase of fallbackCases) {
    it(`serves ${fallbackCase.path} when ${fallbackCase.missingTable} has not been synced`, async () => {
      const compiledQueries: CompiledQuery[] = []
      const driver = new DummyDriver()

      driver.acquireConnection = async () =>
        ({
          executeQuery: async (compiledQuery: CompiledQuery) => {
            compiledQueries.push(compiledQuery)

            if (compiledQuery.sql.includes(`"${fallbackCase.missingTable}"`)) {
              throw new Error(
                `D1_ERROR: no such table: ${fallbackCase.missingTable}`,
              )
            }

            return { rows: [fallbackCase.catalogRow] }
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
        const handler = getD1Handler(fallbackCase.path)
        expect(handler).not.toBeNull()

        const result = await handler!(db, {})
        const rows = result.data[fallbackCase.responseKey] as Array<{
          mfr: string
        }>

        expect(rows).toHaveLength(1)
        expect(rows[0].mfr).toBe(fallbackCase.expectedMfr)
        expect(
          compiledQueries.some((query) =>
            query.sql.includes("component_catalog"),
          ),
        ).toBe(true)
      } finally {
        await db.destroy()
      }
    })
  }
})
