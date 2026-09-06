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

describe("Linux-capable Processors route", () => {
  const processor = {
    lcsc: 5_156_490,
    mfr: "RK3588",
    package: "FCBGA-1088",
    manufacturer: "Rockchip",
    chip_family: "Rockchip RK3588",
    architecture: "ARM64",
    cpu_core: "Cortex-A76 + Cortex-A55",
    description: "Rockchip application processor",
    stock: 100,
    price1: 50,
    in_stock: 1,
    is_basic: 0,
    is_preferred: 1,
    attributes: "{}",
  }
  const optionFields = [
    "package",
    "manufacturer",
    "chip_family",
    "architecture",
    "cpu_core",
  ] as const

  it("queries the category with processor and assembly filters and returns filter options", async () => {
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
            rows: optionField
              ? [{ value: processor[optionField] }]
              : [processor],
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
      const handler = getD1Handler("/linux_capable_processors/list")
      expect(handler).not.toBeNull()

      const result = await handler!(db, {
        package: "FCBGA-1088",
        manufacturer: "Rockchip",
        chip_family: "Rockchip RK3588",
        architecture: "ARM64",
        cpu_core: "Cortex-A76 + Cortex-A55",
        is_basic: "false",
        is_preferred: "true",
      })

      expect(result).toEqual({
        tableName: "linux_capable_processor",
        data: {
          linux_capable_processors: [
            {
              ...processor,
              in_stock: true,
              is_basic: false,
              is_preferred: true,
            },
          ],
        },
        filterOptions: {
          package: ["FCBGA-1088"],
          manufacturer: ["Rockchip"],
          chip_family: ["Rockchip RK3588"],
          architecture: ["ARM64"],
          cpu_core: ["Cortex-A76 + Cortex-A55"],
        },
      })

      const partsQuery = compiledQueries.find((query) =>
        query.sql.startsWith('SELECT * FROM "linux_capable_processor"'),
      )
      expect(partsQuery?.sql).toBe(
        'SELECT * FROM "linux_capable_processor" WHERE "package" = ? AND "manufacturer" = ? AND "chip_family" = ? AND "architecture" = ? AND "cpu_core" = ? AND "is_basic" = ? AND "is_preferred" = ? ORDER BY stock DESC LIMIT 100',
      )
      expect(partsQuery?.parameters).toEqual([
        "FCBGA-1088",
        "Rockchip",
        "Rockchip RK3588",
        "ARM64",
        "Cortex-A76 + Cortex-A55",
        0,
        1,
      ])

      compiledQueries.length = 0
      await handler!(db, { architecture: "All", manufacturer: "" })
      const unfilteredQuery = compiledQueries.find((query) =>
        query.sql.startsWith('SELECT * FROM "linux_capable_processor"'),
      )
      expect(unfilteredQuery?.sql).toBe(
        'SELECT * FROM "linux_capable_processor" ORDER BY stock DESC LIMIT 100',
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
            if (sql.startsWith('SELECT * FROM "linux_capable_processor"')) {
              partsQueries.push({ sql, parameters })
            }
            return {
              results: optionField
                ? [{ value: processor[optionField] }]
                : [processor],
              meta: { changes: 0 },
            }
          },
        }),
      }),
    } as unknown as D1Database

    try {
      const response = await self.fetch(
        "https://example.com/linux_capable_processors/list?manufacturer=Rockchip&architecture=ARM64",
      )

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/html")
      expect(response.headers.get("x-data-source")).toBe("d1")
      const html = await response.text()
      expect(html).toContain("<h2>Linux-capable Processors</h2>")
      expect(html).toContain('name="manufacturer" value="Rockchip"')
      expect(html).toContain('name="architecture" value="ARM64"')
      expect(html).toContain("Cortex-A76 + Cortex-A55")
      expect(html).toContain(
        "/linux_capable_processors/list.json?manufacturer=Rockchip&amp;architecture=ARM64",
      )

      const jsonResponse = await self.fetch(
        "https://example.com/linux_capable_processors/list.json?manufacturer=Rockchip&architecture=ARM64",
      )

      expect(jsonResponse.status).toBe(200)
      expect(jsonResponse.headers.get("content-type")).toContain(
        "application/json",
      )
      expect(jsonResponse.headers.get("x-data-source")).toBe("d1")
      expect(await jsonResponse.json()).toEqual({
        linux_capable_processors: [
          {
            ...processor,
            in_stock: true,
            is_basic: false,
            is_preferred: true,
          },
        ],
      })
      expect(partsQueries).toHaveLength(2)
      for (const query of partsQueries) {
        expect(query.sql).toContain(
          'WHERE "manufacturer" = ? AND "architecture" = ?',
        )
        expect(query.parameters).toEqual(["Rockchip", "ARM64"])
      }
    } finally {
      await self.flushWaitUntil()
    }
  })
})
