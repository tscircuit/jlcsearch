import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /api/search returns is_extended_promotional field", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=10")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)

  const component = res.data.components[0]
  expect(component).toHaveProperty("is_extended_promotional")
  expect(typeof component.is_extended_promotional).toBe("boolean")
})
