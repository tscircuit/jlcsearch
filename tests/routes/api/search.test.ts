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

test("GET /api/search with search query '555 Timer' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=1&q=555%20Timer")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  if (res.data.components.length > 0) {
    // Check for required fields and some basic validation
    const component = res.data.components[0]
    expect(component).toHaveProperty("description")
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
    expect(component).toHaveProperty("lcsc")
    expect(component).toHaveProperty("mfr")
    expect(component).toHaveProperty("package")
    expect(component).toHaveProperty("price")
    expect(component).toHaveProperty("stock")
  }
})

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

test("GET /api/search with . in query", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?q=0.1uf")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
})

test("GET /api/search supports '0402 5.1k resistor'", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=200&q=0402%205.1k%20resistor")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)
  expect(res.data.components.every((c: any) => c.package === "0402")).toBe(true)
  expect(res.data.components.some((c: any) => c.lcsc === 11702)).toBe(true)
})

test("GET /api/search supports 'USB Type-C 16P'", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=200&q=USB%20Type-C%2016P")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)
  expect(res.data.components.some((c: any) => c.lcsc === 2765186)).toBe(true)
})

test("GET /api/search supports '0402 LED'", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=200&q=0402%20LED")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)
  expect(res.data.components.every((c: any) => c.package === "0402")).toBe(true)
  expect(res.data.components.some((c: any) => c.lcsc === 965793)).toBe(true)
})
