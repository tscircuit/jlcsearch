import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /api/search returns is_extended_promotional field on components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?q=resistor&limit=5")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)

  const component = res.data.components[0]
  expect(component).toHaveProperty("is_extended_promotional")
  expect(typeof component.is_extended_promotional).toBe("boolean")
})

test("GET /api/search with is_extended_promotional filter only returns promotional components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/api/search?is_extended_promotional=true&limit=50",
  )

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  // All returned components must be extended promotional
  for (const component of res.data.components) {
    expect(component.is_extended_promotional).toBe(true)
    // Extended promotional = preferred AND NOT basic
    expect(component.is_basic).toBe(false)
    expect(component.is_preferred).toBe(true)
  }
})

test("GET /api/search components have consistent is_extended_promotional with is_basic and is_preferred", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=100")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  for (const component of res.data.components) {
    // is_extended_promotional must be true only when preferred=true AND basic=false
    if (component.is_extended_promotional) {
      expect(component.is_preferred).toBe(true)
      expect(component.is_basic).toBe(false)
    }
    // A basic component should never be extended promotional
    if (component.is_basic) {
      expect(component.is_extended_promotional).toBe(false)
    }
  }
})
