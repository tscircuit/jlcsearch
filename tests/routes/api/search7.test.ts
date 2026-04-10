import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /api/search supports 'USB Type-C 16P'", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=200&q=USB%20Type-C%2016P")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)
  expect(res.data.components.some((c: any) => c.lcsc === 2765186)).toBe(true)
})
