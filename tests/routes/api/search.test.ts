import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /api/search with search query 'ARG05FTC1234N' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?q=ARG05FTC1234N")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  if (res.data.components.length > 0) {
    // Check for required fields in the first component
    const component = res.data.components[0]
    expect(component).toHaveProperty("description")
    expect(component).toHaveProperty("lcsc")
    expect(component).toHaveProperty("mfr")
    expect(component.mfr).toContain("ARG05FTC1234N") // More specific check
    expect(component).toHaveProperty("package")
    expect(component).toHaveProperty("price")
    expect(component).toHaveProperty("stock")
  }
})

test("GET /api/search with search query '555 Timer' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=1&q=555%20Timer")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  if (res.data.components.length > 0) {
    // Check for required fields and some basic validation
    const component = res.data.components[0]
    expect(component).toHaveProperty("description")
    expect(component.description.toLowerCase()).toContain("555")
    expect(component).toHaveProperty("lcsc")
    expect(component).toHaveProperty("mfr")
    expect(component).toHaveProperty("package")
    expect(component).toHaveProperty("price")
    expect(component).toHaveProperty("stock")
  }
})

test("GET /api/search with search query 'red led' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=1&q=red%20led")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  if (res.data.components.length > 0) {
    // Check for required fields and some basic validation
    const component = res.data.components[0]
    expect(component).toHaveProperty("description")
    expect(component.description.toLowerCase()).toContain("red")
    expect(component.description.toLowerCase()).toContain("led")
    expect(component).toHaveProperty("lcsc")
    expect(component).toHaveProperty("mfr")
    expect(component).toHaveProperty("package")
    expect(component).toHaveProperty("price")
    expect(component).toHaveProperty("stock")
  }
})
