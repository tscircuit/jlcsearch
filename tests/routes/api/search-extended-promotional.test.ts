import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /api/search includes is_extended_promotional field", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=1&q=STM32F401RCT6")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  if (res.data.components.length > 0) {
    expect(res.data.components[0]).toHaveProperty("is_extended_promotional")
  }
})
