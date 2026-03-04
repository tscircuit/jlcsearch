import { test, expect } from "bun:test"
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

test("GET /api/search handles mixed package/value query '0402 5.1k resistor'", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=10&q=0402%205.1k%20resistor")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)

  const hasRelevantResult = res.data.components.some((component: any) => {
    const haystack =
      `${component.mfr} ${component.description} ${component.package}`.toLowerCase()
    return haystack.includes("0402") && haystack.includes("resistor")
  })

  expect(hasRelevantResult).toBe(true)
})

test("GET /api/search handles connector query 'USB Type-C 16P'", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=10&q=USB%20Type-C%2016P")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)

  const hasRelevantResult = res.data.components.some((component: any) => {
    const haystack =
      `${component.mfr} ${component.description} ${component.package}`.toLowerCase()
    return (
      haystack.includes("usb") &&
      (haystack.includes("type-c") || haystack.includes("type c")) &&
      haystack.includes("16")
    )
  })

  expect(hasRelevantResult).toBe(true)
})

test("GET /api/search handles LED package query '0402 LED'", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=10&q=0402%20LED")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)

  const hasRelevantResult = res.data.components.some((component: any) => {
    const haystack =
      `${component.mfr} ${component.description} ${component.package}`.toLowerCase()
    return haystack.includes("0402") && haystack.includes("led")
  })

  expect(hasRelevantResult).toBe(true)
})
