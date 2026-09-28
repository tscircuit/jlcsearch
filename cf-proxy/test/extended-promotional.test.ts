import { describe, expect, it } from "vitest"
import { getD1Client } from "../src/db/get-d1-client"
import { searchIndex } from "../src/search"

interface MockRow {
  lcsc: number
  mfr: string
  package: string
  description: string
  stock: number
  price: string
  price1: number
  basic: number
  preferred: number
  is_extended_promotional: number
  category: string
  subcategory: string
}

const mockRows: MockRow[] = [
  {
    lcsc: 1001,
    mfr: "Manufacturer A",
    package: "SOIC-8",
    description: "Component 1",
    stock: 100,
    price: "[]",
    price1: 1.0,
    basic: 1,
    preferred: 0,
    is_extended_promotional: 1,
    category: "ICs",
    subcategory: "OpAmps",
  },
  {
    lcsc: 1002,
    mfr: "Manufacturer B",
    package: "SOIC-8",
    description: "Component 2",
    stock: 200,
    price: "[]",
    price1: 2.0,
    basic: 0,
    preferred: 1,
    is_extended_promotional: 0,
    category: "ICs",
    subcategory: "OpAmps",
  },
]

const createMockD1 = (data: MockRow[] = mockRows): D1Database => {
  return {
    async exec(_query: string) {
      return { count: 0, duration: 0 }
    },
    prepare(querySql: string) {
      return {
        bind(..._args: any[]) {
          return {
            async all() {
              let results = data
              if (querySql.includes("is_extended_promotional = 1")) {
                results = data.filter((r) => r.is_extended_promotional === 1)
              }
              return {
                results,
                success: true,
                meta: { changes: 0, duration: 0 },
              }
            },
            async first() {
              const res = (await this.all()).results
              return res[0] ?? null
            },
            async run() {
              return { success: true, meta: { changes: 0, duration: 0 } }
            },
          }
        },
        async all() {
          let results = data
          if (querySql.includes("is_extended_promotional = 1")) {
            results = data.filter((r) => r.is_extended_promotional === 1)
          }
          return { results, success: true, meta: { changes: 0, duration: 0 } }
        },
        async first() {
          const res = (await this.all()).results
          return res[0] ?? null
        },
        async run() {
          return { success: true, meta: { changes: 0, duration: 0 } }
        },
      } as any
    },
  } as unknown as D1Database
}

describe("is_extended_promotional filter", () => {
  it("filters search results when parameter is set to true or 1", async () => {
    const mockD1 = createMockD1()
    const db = getD1Client(mockD1)

    // Query searchIndex with is_extended_promotional = "true"
    const results = await searchIndex(db, {
      is_extended_promotional: "true",
      limit: "10",
    })

    // Verify it only returns the promotional component
    expect(results).toHaveLength(1)
    expect(results[0].lcsc).toBe(1001)
    expect(results[0].is_extended_promotional).toBe(1)

    // Query without the filter
    const allResults = await searchIndex(db, {
      limit: "10",
    })
    expect(allResults).toHaveLength(2)
  })
})
