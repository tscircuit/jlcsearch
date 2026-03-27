import { expect, test } from "bun:test"
import searchRoute from "routes/api/search"

test("GET /api/search maps is_extended_promotional and filters on it", async () => {
  let captured: any = null
  let filterApplied = false

  const fakeQuery = {
    selectAll() {
      return this
    },
    limit() {
      return this
    },
    orderBy() {
      return this
    },
    where(field: any, op: any, value: any) {
      if (field === "is_extended_promotional" && op === "=" && value === 1) {
        filterApplied = true
      }
      return this
    },
    async execute() {
      return [
        {
          lcsc: 123,
          mfr: "Demo Part",
          package: "0402",
          basic: 1,
          preferred: 0,
          is_extended_promotional: 1,
          description: "demo",
          stock: 10,
          price: '[{"price":"0.01"}]',
        },
      ]
    },
  }

  const req: any = {
    query: { q: undefined, is_extended_promotional: true },
  }
  const ctx: any = {
    db: {
      selectFrom(table: string) {
        expect(table).toBe("components")
        return fakeQuery
      },
    },
    json(payload: any) {
      captured = payload
      return payload
    },
  }

  await (searchRoute as any)(req, ctx)
  expect(filterApplied).toBe(true)
  expect(captured.components[0]).toHaveProperty("is_extended_promotional", true)
})
