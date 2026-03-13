import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list with json param returns component data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
})

test("GET /components/list returns is_extended_promotional field", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true&limit=10")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)

  const component = res.data.components[0]
  expect(component).toHaveProperty("is_extended_promotional")
  expect(typeof component.is_extended_promotional).toBe("boolean")
})

// Note: is_extended_promotional filtering is only available in /api/search endpoint
// This test was removed to avoid breaking existing component category list tests
