import { expect, test } from "bun:test"
import listRoute from "routes/components/list"

test("GET /components/list maps is_extended_promotional and filters on it", async () => {
  let captured: any = null
  let filterApplied = false

  const fakeQuery = {
    select() {
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
          lcsc: 456,
          mfr: "Demo Part 2",
          package: "0603",
          basic: 0,
          preferred: 1,
          is_extended_promotional: 1,
          description: "demo2",
          stock: 8,
          price: '[{"price":"0.02"}]',
          extra: null,
        },
      ]
    },
  }

  const req: any = {
    query: { is_extended_promotional: true, full: false },
  }
  const ctx: any = {
    db: {
      selectFrom(table: string) {
        expect(table).toBe("v_components")
        return fakeQuery
      },
    },
    isApiRequest: true,
    json(payload: any) {
      captured = payload
      return payload
    },
  }

  await (listRoute as any)(req, ctx)
  expect(filterApplied).toBe(true)
  expect(captured.components[0]).toHaveProperty("is_extended_promotional", true)
})
