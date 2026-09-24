import { describe, expect, it } from "vitest"
import { createSelf, createTestEnv } from "./test-env"

const catalogRows = [
  { lcsc: 101, preferred: 1 },
  { lcsc: 102, preferred: 0 },
  { lcsc: 103, preferred: null },
].map((row) => ({
  ...row,
  mfr: `Part ${row.lcsc}`,
  package: "SMD",
  description: "Synthetic test part",
  stock: 10,
  price: '[{"qFrom":1,"price":0.5}]',
  price1: 0.5,
  basic: 0,
  category: "Test",
  subcategory: "Test parts",
}))

const createCatalogWorker = () => {
  const env = createTestEnv()
  const queries: Array<{ sql: string; parameters: unknown[] }> = []
  env.USE_D1 = "true"
  env.DB = {
    prepare: (sql: string) => ({
      bind: (...parameters: unknown[]) => ({
        all: async () => {
          queries.push({ sql, parameters })
          // This mock models only the preferred equality in these requests.
          // Tests independently assert the emitted SQL and its bound value.
          const hasPreferredFilter = /search_index\.preferred\s*=\s*\?/.test(
            sql,
          )
          const results = hasPreferredFilter
            ? catalogRows.filter(
                (row) =>
                  row.preferred === parameters[0] ||
                  (row.preferred === null &&
                    sql.includes("search_index.preferred IS NULL")),
              )
            : catalogRows
          return { results, meta: { changes: 0 } }
        },
      }),
    }),
  } as unknown as D1Database
  return { self: createSelf(env), queries }
}

interface FilterCase {
  name: string
  params: Record<string, string>
  expectedFilter?: 0 | 1
}

const filterCases: FilterCase[] = [
  { name: "unfiltered", params: {} },
  {
    name: "canonical true",
    params: { is_extended_promotional: "true" },
    expectedFilter: 1,
  },
  {
    name: "canonical 1",
    params: { is_extended_promotional: "1" },
    expectedFilter: 1,
  },
  {
    name: "canonical false",
    params: { is_extended_promotional: "false" },
    expectedFilter: 0,
  },
  {
    name: "canonical 0",
    params: { is_extended_promotional: "0" },
    expectedFilter: 0,
  },
  {
    name: "legacy true",
    params: { is_preferred: "true" },
    expectedFilter: 1,
  },
  {
    name: "legacy 1",
    params: { is_preferred: "1" },
    expectedFilter: 1,
  },
  {
    name: "legacy false remains unfiltered",
    params: { is_preferred: "false" },
  },
  { name: "legacy 0 remains unfiltered", params: { is_preferred: "0" } },
  {
    name: "canonical false wins over legacy true",
    params: { is_extended_promotional: "false", is_preferred: "true" },
    expectedFilter: 0,
  },
  {
    name: "canonical true wins over legacy false",
    params: { is_extended_promotional: "true", is_preferred: "false" },
    expectedFilter: 1,
  },
  {
    name: "canonical All wins over legacy true",
    params: { is_extended_promotional: "", is_preferred: "true" },
  },
  {
    name: "invalid canonical does not fall back to legacy true",
    params: { is_extended_promotional: "invalid", is_preferred: "true" },
  },
]

describe("extended promotional search aliases", () => {
  for (const pathname of ["/api/search", "/components/list.json"]) {
    for (const { name, params, expectedFilter } of filterCases) {
      it(`${pathname}: ${name}`, async () => {
        const { self, queries } = createCatalogWorker()
        try {
          const url = new URL(pathname, "https://example.com")
          url.search = new URLSearchParams(params).toString()
          const response = await self.fetch(url)
          expect(response.status).toBe(200)
          expect(response.headers.get("content-type")).toContain(
            "application/json",
          )
          const data = (await response.json()) as {
            components: Array<{
              lcsc: number
              is_preferred: boolean
              is_extended_promotional: boolean
            }>
          }
          const expectedRows = catalogRows.filter(
            (row) =>
              expectedFilter === undefined ||
              (expectedFilter === 1
                ? row.preferred === 1
                : row.preferred === 0 || row.preferred === null),
          )
          expect(data.components.map((row) => row.lcsc)).toEqual(
            expectedRows.map((row) => row.lcsc),
          )
          for (const [index, row] of data.components.entries()) {
            expect(row.is_extended_promotional).toBe(
              Boolean(expectedRows[index].preferred),
            )
            expect(row.is_preferred).toBe(row.is_extended_promotional)
          }
          expect(queries).toHaveLength(1)
          const query = queries[0]
          const comparisons = query.sql.match(
            /search_index\.preferred\s*=\s*\?/g,
          )
          expect(comparisons ?? []).toHaveLength(
            expectedFilter === undefined ? 0 : 1,
          )
          expect(query.parameters).toEqual(
            expectedFilter === undefined ? [100] : [expectedFilter, 100],
          )
          expect(query.sql.includes("search_index.preferred IS NULL")).toBe(
            expectedFilter === 0,
          )
        } finally {
          await self.flushWaitUntil()
        }
      })
    }
  }

  it("supports components JSON via the json query parameter", async () => {
    const { self } = createCatalogWorker()
    try {
      const response = await self.fetch(
        "https://example.com/components/list?json=true&is_extended_promotional=1",
      )
      const data = (await response.json()) as {
        components: Array<{ is_extended_promotional: boolean }>
      }
      expect(response.status).toBe(200)
      expect(data.components).toHaveLength(1)
      expect(data.components[0].is_extended_promotional).toBe(true)
    } finally {
      await self.flushWaitUntil()
    }
  })

  for (const { name, params, expectedFilter } of filterCases) {
    it(`components HTML has one promotional control and column: ${name}`, async () => {
      const { self } = createCatalogWorker()
      try {
        const url = new URL("/components/list", "https://example.com")
        url.search = new URLSearchParams(params).toString()
        const response = await self.fetch(url)
        const html = await response.text()
        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toContain("text/html")
        expect(html.match(/name="is_extended_promotional"/g)).toHaveLength(1)
        expect(html).not.toContain('name="is_preferred"')
        expect(html.match(/>Promotional Extended<\/th>/g)).toHaveLength(1)
        expect(html).not.toContain(">Preferred</th>")
        const selectedValue =
          expectedFilter === undefined
            ? ""
            : expectedFilter === 1
              ? "true"
              : "false"
        expect(html).toContain(`<option value="${selectedValue}" selected>`)
        expect(html).toContain("/components/list.json")
      } finally {
        await self.flushWaitUntil()
      }
    })
  }
})
