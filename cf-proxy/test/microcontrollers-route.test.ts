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

describe("minimum rated MCU clock", () => {
  it("roundtrips units through the GET form and JSON link, and clears the filter", async () => {
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
                  {
                    lcsc: 8734,
                    mfr: "STM32F103C8T6",
                    cpu_speed_hz: 72000000,
                    stock: 1,
                  },
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
      const params = new URLSearchParams({
        cpu_speed_min_hz: "72 MHz",
        has_usb: "true",
      })
      const html = await (
        await self.fetch(`https://example.com/microcontrollers/list?${params}`)
      ).text()
      expect(html).toContain("Min Rated CPU Clock")
      expect(html).toContain('name="cpu_speed_min_hz" value="72 MHz"')
      expect(html).toContain("Listed maximum CPU clock")
      expect(html).toContain("Rated Max CPU Clock")
      expect(html).toContain("72MHz")
      const jsonLink = html
        .match(/href="([^"]*\/microcontrollers\/list\.json\?[^"]*)"/)![1]
        .replaceAll("&amp;", "&")
      expect(
        new URL(jsonLink, "https://example.com").searchParams.get(
          "cpu_speed_min_hz",
        ),
      ).toBe("72 MHz")
      const json = await self.fetch(
        new URL(jsonLink, "https://example.com").href,
      )
      expect(await json.json()).toMatchObject({
        microcontrollers: [{ cpu_speed_hz: 72000000 }],
      })
      for (const query of queries) {
        expect(query.sql).toContain('"cpu_speed_hz" >= ?')
        expect(query.parameters).toContain(72000000)
        expect(query.parameters).toContain(1)
      }
      expect(queries).toHaveLength(2)
      const clearLink = html.match(/href="([^"]*)">Clear filters<\/a>/)![1]
      const cleared = await (
        await self.fetch(`https://example.com${clearLink}`)
      ).text()
      expect(cleared).toContain('name="cpu_speed_min_hz" value=""')
      expect(queries[2].sql).not.toContain('"cpu_speed_hz" >=')
      await self.fetch(
        "https://example.com/microcontrollers/list.json?cpu_speed_min_hz=72MHzjunk",
      )
      expect(queries[3].sql).toContain("0 = 1")
      const otherCategory = await (
        await self.fetch(
          "https://example.com/resistors/list?cpu_speed_min_hz=72MHz",
        )
      ).text()
      expect(otherCategory).not.toContain('name="cpu_speed_min_hz"')
    } finally {
      await self.flushWaitUntil()
    }
  })
})
