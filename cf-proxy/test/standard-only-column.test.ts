import { describe, expect, it } from "vitest"
import { createSelf, createTestEnv } from "./test-env"

describe("Standard-only column and filter", () => {
  const parts = [
    { lcsc: 701341, mfr: "ESP32-WROOM-32E-N4", stock: 100, is_preferred: 0 },
    { lcsc: 2040, mfr: "RP2040", stock: 50, is_preferred: 0 },
    { lcsc: 999, mfr: "Not crawled yet", stock: 10, is_preferred: 0 },
  ]
  const marks = [
    { lcsc: 701341, is_standard_only: 1 },
    { lcsc: 2040, is_standard_only: 0 },
  ]

  const createEnv = (
    queries: Array<{ sql: string; parameters: unknown[] }>,
  ) => {
    const env = createTestEnv()
    env.USE_D1 = "true"
    env.DB = {
      prepare: (sql: string) => ({
        bind: (...parameters: unknown[]) => ({
          all: async () => {
            queries.push({ sql, parameters })
            const results = sql.startsWith(
              "SELECT lcsc, is_standard_only FROM _jlcsearch_live_stock",
            )
              ? marks
              : sql.includes("AS value")
                ? []
                : parts
            return { results, meta: { changes: 0 } }
          },
        }),
      }),
    } as unknown as D1Database
    return env
  }

  it("adds the mark after Preferred: Yes, No, or unknown", async () => {
    const queries: Array<{ sql: string; parameters: unknown[] }> = []
    const self = createSelf(createEnv(queries))
    try {
      const response = await self.fetch(
        "https://example.com/ethernet_controllers/list.json",
      )
      const body = (await response.json()) as {
        ethernet_controllers: Array<Record<string, unknown>>
      }
      expect(
        body.ethernet_controllers.map((part) => [
          part.lcsc,
          part.is_standard_only,
        ]),
      ).toEqual([
        [701341, true],
        [2040, false],
        [999, null],
      ])
      expect(Object.keys(body.ethernet_controllers[0] ?? {})).toEqual([
        "lcsc",
        "mfr",
        "stock",
        "is_preferred",
        "is_standard_only",
      ])
      const markQuery = queries.find((query) =>
        query.sql.startsWith("SELECT lcsc, is_standard_only"),
      )
      expect(markQuery?.parameters).toEqual([701341, 2040, 999])

      const html = await (
        await self.fetch("https://example.com/ethernet_controllers/list")
      ).text()
      expect(html).toContain("Standard Only")
      expect(html).toContain('name="is_standard_only"')
      expect(html).toContain('<span title="Not checked yet">?</span>')
    } finally {
      await self.flushWaitUntil()
    }
  })

  it("filters every category table on the mark", async () => {
    const queries: Array<{ sql: string; parameters: unknown[] }> = []
    const self = createSelf(createEnv(queries))
    try {
      await self.fetch(
        "https://example.com/ethernet_controllers/list.json?is_standard_only=true",
      )
      const partsQuery = queries.find((query) =>
        query.sql.startsWith('SELECT * FROM "ethernet_controller"'),
      )
      expect(partsQuery?.sql).toContain(
        '"lcsc" IN (SELECT lcsc FROM _jlcsearch_live_stock WHERE is_standard_only = ?)',
      )
      expect(partsQuery?.parameters).toEqual([1])
    } finally {
      await self.flushWaitUntil()
    }
  })
})
