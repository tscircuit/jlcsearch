import { describe, expect, it } from "vitest"
import { createSelf, createTestEnv } from "./test-env"

describe.each([
  "has_usb",
  "has_usb_host",
  "has_can",
  "has_spi",
  "has_i2c",
  "has_uart",
])("microcontroller %s filter", (field) => {
  it.each(["true", "false", ""])(
    "filters HTML and JSON with %s",
    async (value) => {
      const env = createTestEnv()
      const self = createSelf(env)
      const queries: Array<{ sql: string; parameters: unknown[] }> = []
      env.USE_D1 = "true"
      env.DB = {
        prepare: (sql: string) => ({
          bind: (...parameters: unknown[]) => ({
            all: async () => {
              if (sql.startsWith('SELECT * FROM "microcontroller"')) {
                queries.push({ sql, parameters })
                return {
                  results: [
                    { lcsc: 2040, mfr: "RP2040", [field]: 1, stock: 123 },
                  ],
                  meta: {},
                }
              }
              return { results: [], meta: {} }
            },
          }),
        }),
      } as unknown as D1Database
      try {
        const params = `${field}=${value}&package=QFN&core=ARM-M0&flash_min=32&ram_min=16`
        const response = await self.fetch(
          `https://example.com/microcontrollers/list?${params}`,
        )
        expect(response.status).toBe(200)
        const html = await response.text()
        expect(html).toContain("Has USB")
        expect(html).toContain(`select name="${field}"`)
        if (value) expect(html).toContain(`value="${value}" selected`)
        expect(html).toContain(
          `/microcontrollers/list.json?${field}=${value}&amp;package=QFN`,
        )
        const json = await self.fetch(
          `https://example.com/microcontrollers/list.json?${params}`,
        )
        expect(json.status).toBe(200)
        expect(await json.json()).toMatchObject({
          microcontrollers: [{ [field]: true }],
        })
        expect(queries).toHaveLength(2)
        for (const query of queries) {
          if (value) {
            expect(query.sql).toContain(`"${field}" = ?`)
            expect(query.parameters).toEqual([
              "QFN",
              value === "true" ? 1 : 0,
              "ARM-M0",
              32,
              16,
            ])
          } else {
            expect(query.sql).not.toContain(`"${field}" =`)
            expect(query.parameters).toEqual(["QFN", "ARM-M0", 32, 16])
          }
        }
      } finally {
        await self.flushWaitUntil()
      }
    },
  )
})
