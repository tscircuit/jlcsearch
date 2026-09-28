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
import { createSelf, createTestEnv } from "./test-env"

describe("Stepper Motor Driver route", () => {
  const part = {
    lcsc: 22_396_981,
    mfr: "FM TC6803S",
    package: "SSOP-24",
    description: "Stepper Motor Driver",
    stock: 100,
    price1: 50,
    in_stock: 1,
    is_basic: 0,
    is_preferred: 1,
    attributes: "{}",
  }
  const optionFields = ["package"] as const

  it("queries the category with part and assembly filters and returns filter options", async () => {
    const compiledQueries: CompiledQuery[] = []
    const driver = new DummyDriver()

    driver.acquireConnection = async () =>
      ({
        executeQuery: async (compiledQuery: CompiledQuery) => {
          compiledQueries.push(compiledQuery)
          const optionField = optionFields.find((field) =>
            compiledQuery.sql.includes(`CAST("${field}" AS TEXT) AS value`),
          )
          return {
            rows: optionField ? [{ value: part[optionField] }] : [part],
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
      const handler = getD1Handler("/stepper_motor_drivers/list")
      expect(handler).not.toBeNull()

      const result = await handler!(db, {
        package: "SSOP-24",
        is_basic: "false",
        is_preferred: "true",
      })

      expect(result).toEqual({
        tableName: "stepper_motor_driver",
        data: {
          stepper_motor_drivers: [
            {
              ...part,
              in_stock: true,
              is_basic: false,
              is_preferred: true,
            },
          ],
        },
        filterOptions: {
          package: ["SSOP-24"],
        },
      })

      const partsQuery = compiledQueries.find((query) =>
        query.sql.startsWith('SELECT * FROM "stepper_motor_driver"'),
      )
      expect(partsQuery?.sql).toBe(
        'SELECT * FROM "stepper_motor_driver" WHERE "package" = ? AND "is_basic" = ? AND "is_preferred" = ? ORDER BY stock DESC LIMIT 100',
      )
      expect(partsQuery?.parameters).toEqual(["SSOP-24", 0, 1])

      compiledQueries.length = 0
      await handler!(db, { package: "All" })
      const unfilteredQuery = compiledQueries.find((query) =>
        query.sql.startsWith('SELECT * FROM "stepper_motor_driver"'),
      )
      expect(unfilteredQuery?.sql).toBe(
        'SELECT * FROM "stepper_motor_driver" ORDER BY stock DESC LIMIT 100',
      )
      expect(unfilteredQuery?.parameters).toEqual([])
    } finally {
      await db.destroy()
    }
  })

  it("serves the filtered HTML page and JSON API through the worker", async () => {
    const env = createTestEnv()
    const self = createSelf(env)
    const partsQueries: Array<{ sql: string; parameters: unknown[] }> = []
    env.USE_D1 = "true"
    env.DB = {
      prepare: (sql: string) => ({
        bind: (...parameters: unknown[]) => ({
          all: async () => {
            const optionField = optionFields.find((field) =>
              sql.includes(`CAST("${field}" AS TEXT) AS value`),
            )
            if (sql.startsWith('SELECT * FROM "stepper_motor_driver"')) {
              partsQueries.push({ sql, parameters })
            }
            return {
              results: optionField ? [{ value: part[optionField] }] : [part],
              meta: { changes: 0 },
            }
          },
        }),
      }),
    } as unknown as D1Database

    try {
      const response = await self.fetch(
        "https://example.com/stepper_motor_drivers/list?package=SSOP-24",
      )

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/html")
      expect(response.headers.get("x-data-source")).toBe("d1")
      const html = await response.text()
      expect(html).toContain("<h2>Stepper Motor Driver</h2>")
      expect(html).toContain("/stepper_motor_drivers/list.json?package=SSOP-24")

      const jsonResponse = await self.fetch(
        "https://example.com/stepper_motor_drivers/list.json?package=SSOP-24",
      )

      expect(jsonResponse.status).toBe(200)
      expect(jsonResponse.headers.get("content-type")).toContain(
        "application/json",
      )
      expect(jsonResponse.headers.get("x-data-source")).toBe("d1")
      expect(await jsonResponse.json()).toEqual({
        stepper_motor_drivers: [
          {
            ...part,
            in_stock: true,
            is_basic: false,
            is_preferred: true,
          },
        ],
      })
      expect(partsQueries).toHaveLength(2)
      for (const query of partsQueries) {
        expect(query.sql).toContain('WHERE "package" = ?')
        expect(query.parameters).toEqual(["SSOP-24"])
      }
    } finally {
      await self.flushWaitUntil()
    }
  })
})
