import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /api/search with is_extended_promotional=true filters correctly", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/api/search?is_extended_promotional=true&limit=100",
  )

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  // All returned components should be extended promotional (preferred=1 AND basic=0)
  res.data.components.forEach((c: any) => {
    expect(c.is_preferred).toBe(true)
    expect(c.is_basic).toBe(false)
    expect(c.is_extended_promotional).toBe(true)
  })
})
