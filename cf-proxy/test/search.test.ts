import { describe, expect, it } from "vitest"
import { getD1Client } from "../src/db/get-d1-client"
import { searchIndex } from "../src/search"

type MetaRow = { key: string; value: string }

const createScriptedD1 = (metaRows: MetaRow[]) => {
  const statements: string[] = []
  const d1 = {
    prepare: (query: string) => {
      statements.push(query)
      const respond = async () => ({
        success: true,
        results: /search_index_fts_meta/.test(query) ? metaRows : [],
        meta: { changes: 0, last_row_id: 0, duration: 0 },
      })
      const statement = {
        bind: () => statement,
        all: respond,
        run: respond,
        first: async () => (await respond()).results[0] ?? null,
        raw: async () => [],
      }
      return statement
    },
  } as unknown as D1Database
  return { d1, statements }
}

const findSearchStatement = (statements: string[]) =>
  statements.find(
    (statement) =>
      /FROM search_index\b/.test(statement) &&
      !/search_index_fts_meta/.test(statement),
  ) ?? ""

describe("searchIndex", () => {
  it("joins the FTS index on lcsc and re-checks the match on search_index", async () => {
    const { d1, statements } = createScriptedD1([
      { key: "ready", value: "1" },
      { key: "schema", value: "2" },
    ])

    await searchIndex(getD1Client(d1), { q: "stm32f103" })

    const query = findSearchStatement(statements)
    expect(query).toContain(
      "JOIN search_index_fts ON search_index_fts.lcsc = search_index.lcsc",
    )
    expect(query).not.toContain("search_index_fts.rowid")
    expect(query).toContain("search_index_fts.search_text LIKE")
    expect(query).toContain("search_index.search_text LIKE")
  })

  it("falls back to a LIKE search when the FTS index predates the lcsc join", async () => {
    const { d1, statements } = createScriptedD1([{ key: "ready", value: "1" }])

    await searchIndex(getD1Client(d1), { q: "stm32f103" })

    const query = findSearchStatement(statements)
    expect(query).not.toContain("search_index_fts")
    expect(query).toContain("search_index.search_text LIKE")
  })

  it("falls back to a LIKE search while the FTS index is being rebuilt", async () => {
    const { d1, statements } = createScriptedD1([
      { key: "ready", value: "0" },
      { key: "schema", value: "2" },
    ])

    await searchIndex(getD1Client(d1), { q: "stm32f103" })

    expect(findSearchStatement(statements)).not.toContain("search_index_fts")
  })

  it("looks a part code up by lcsc without touching the FTS index", async () => {
    const { d1, statements } = createScriptedD1([])

    await searchIndex(getD1Client(d1), { q: "C8734" })

    expect(
      statements.some((statement) => /search_index_fts/.test(statement)),
    ).toBe(false)
    expect(findSearchStatement(statements)).toContain("search_index.lcsc = ?")
  })
})
