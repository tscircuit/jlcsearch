import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /api/search with search query 'STM32F401RCT6' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?q=STM32F401RCT6")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)

  // Check for required fields in the first component
  const component = res.data.components[0]
  expect(component).toHaveProperty("description")
  expect(component).toHaveProperty("lcsc")
  expect(component).toHaveProperty("mfr")
  expect(component.mfr).toContain("STM32F401RCT6") // More specific check
  expect(component).toHaveProperty("package")
  expect(component).toHaveProperty("price")
  expect(component).toHaveProperty("stock")
  expect(component).toHaveProperty("is_extended_promotional")
  expect(typeof component.is_extended_promotional).toBe("boolean")
})
