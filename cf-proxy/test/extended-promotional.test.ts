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
                  lcsc: 12346,
                  mfr: "PROMO-EXT",
                  package: "SMD",
                  description: "HDMI promotional extended part",
                  stock: 100,
                  price: "1-:0.50",
                  price1: 0.5,
                  basic: 0,
                  preferred: 1,
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

describe("extended promotional search", () => {
  it("filters on the source-backed preferred and non-basic flags", async () => {
    const { database, statements } = createRecordingD1()
    const db = getD1Client(database)

    const rows = await searchIndex(db, { is_extended_promotional: "true" })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      lcsc: 12346,
      basic: 0,
      preferred: 1,
    })

    const executedSql = statements.map((statement) => statement.sql).join("\n")
    expect(executedSql).toContain("search_index.preferred = 1")
    expect(executedSql).toContain("search_index.basic = 0")

    await db.destroy()
  })
})
