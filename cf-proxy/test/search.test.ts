import { describe, expect, it } from "vitest"
import { getD1Client } from "../src/db/get-d1-client"
import { searchIndex } from "../src/search"

type RecordedStatement = {
  sql: string
  parameters: unknown[]
}

const createRecordingD1 = () => {
  const statements: RecordedStatement[] = []
  const database = {
    prepare(sql: string) {
      return {
        bind(...parameters: unknown[]) {
          statements.push({ sql, parameters })
          return {
            all: async () => ({
              results: [
                {
                  lcsc: 12345,
                  mfr: "PROMO-PART",
                  package: "SMD",
                  description: "Promotional extended part",
                  stock: 100,
                  price: "1-:1.00",
                  price1: 1,
                  basic: 0,
                  preferred: 1,
                  extended_promotional: 1,
                  category: "Connectors",
                  subcategory: "HDMI Connectors",
                },
              ],
              meta: { changes: 0 },
            }),
          }
        },
      }
    },
  } as unknown as D1Database

  return { database, statements }
}

describe("searchIndex extended promotional filter", () => {
  it("adds the filter to the compiled D1 query when requested", async () => {
    const { database, statements } = createRecordingD1()
    const db = getD1Client(database)

    const rows = await searchIndex(db, { is_extended_promotional: "true" })

    expect(rows[0]?.extended_promotional).toBe(1)
    expect(statements).toHaveLength(1)
    expect(statements[0]?.sql).toContain(
      "search_index.extended_promotional = 1",
    )
    expect(statements[0]?.parameters).toEqual([100])
    await db.destroy()
  })

  it("does not constrain extended promotional status by default", async () => {
    const { database, statements } = createRecordingD1()
    const db = getD1Client(database)

    await searchIndex(db, {})

    expect(statements).toHaveLength(1)
    expect(statements[0]?.sql).not.toContain(
      "search_index.extended_promotional = 1",
    )
    await db.destroy()
  })
})
