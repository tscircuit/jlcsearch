import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /api/search with . in query", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?q=0.1uf")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
})
