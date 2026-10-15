import { describe, expect, it } from "vitest"
import { createSelf, createTestEnv } from "./test-env"

describe("PSRAM route", () => {
  const psram = {
    lcsc: 5360304,
    mfr: "APS6404L-SQN-SN",
    package: "SOP-8",
    interface_type: "OPI",
    memory_size_mbit: 64,
    clock_frequency_mhz: 133,
    stock: 100,
    price1: 2.4,
    in_stock: 1,
    is_basic: 0,
    is_preferred: 1,
    attributes: "{}",
  }
  const optionFields = [
    "package",
    "interface_type",
    "memory_size_mbit",
  ] as const
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
            if (sql.startsWith('SELECT * FROM "psram"')) {
              partsQueries.push({ sql, parameters })
            }
            return {
              results: optionField
                ? [{ value: String(psram[optionField]) }]
                : [psram],
              meta: { changes: 0 },
            }
          },
        }),
      }),
    } as unknown as D1Database

    try {
      const response = await self.fetch(
        "https://example.com/psrams/list?interface_type=OPI&memory_size_mbit=64&clock_frequency_min_mhz=100&is_basic=false&is_preferred=true",
      )

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/html")
      expect(response.headers.get("x-data-source")).toBe("d1")
      const html = await response.text()
      expect(html).toContain("<h2>PSRAM</h2>")
      expect(html).toContain('name="interface_type" value="OPI"')
      expect(html).toContain('name="memory_size_mbit" value="64"')
      expect(html).toContain("APS6404L-SQN-SN")
      expect(html).toContain(
        "/psrams/list.json?interface_type=OPI&amp;memory_size_mbit=64&amp;clock_frequency_min_mhz=100&amp;is_basic=false&amp;is_preferred=true",
      )

      const jsonResponse = await self.fetch(
        "https://example.com/psrams/list.json?interface_type=OPI&memory_size_mbit=64&clock_frequency_min_mhz=100&is_basic=false&is_preferred=true",
      )

      expect(jsonResponse.status).toBe(200)
      expect(jsonResponse.headers.get("content-type")).toContain(
        "application/json",
      )
      expect(jsonResponse.headers.get("x-data-source")).toBe("d1")
      expect(await jsonResponse.json()).toEqual({
        psrams: [
          {
            ...psram,
            in_stock: true,
            is_basic: false,
            is_preferred: true,
          },
        ],
      })
      expect(partsQueries).toHaveLength(2)
      for (const query of partsQueries) {
        expect(query.sql).toContain(
          'WHERE "interface_type" = ? AND "memory_size_mbit" = ? AND "clock_frequency_mhz" >= ? AND "is_basic" = ? AND "is_preferred" = ?',
        )
        expect(query.parameters).toEqual(["OPI", 64, 100, 0, 1])
      }
    } finally {
      await self.flushWaitUntil()
    }
  })
})
