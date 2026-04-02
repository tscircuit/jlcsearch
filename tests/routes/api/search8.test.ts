import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /api/search supports '0402 LED'", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=200&q=0402%20LED")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)
  expect(res.data.components.every((c: any) => c.package === "0402")).toBe(true)
  expect(res.data.components.some((c: any) => c.lcsc === 965793)).toBe(true)
})
