import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /api/search with part number strips leading 'C'", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?q=C1002")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBe(1)

  const component = res.data.components[0]
  expect(component).toHaveProperty("lcsc", 1002)
  expect(component).toHaveProperty("mfr")
})
