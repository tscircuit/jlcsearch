import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /api/search with search query 'C1234' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=1&q=C1234")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  expect(res.data.components[0]).toMatchObject({
    description:
      "125mW Thin Film Resistor 100V ±25ppm/℃ ±1% 1.23MΩ 0805 Chip Resistor - Surface Mount ROHS",
    lcsc: 217796,
    mfr: "ARG05FTC1234N",
    package: "0805",
    price: 0.005642857,
  })
})

test("GET /api/search with search query '555 Timer' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=1&q=555%20Timer")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  expect(res.data.components[0]).toMatchObject({
    description: "DIP-8 555 Timers / Counters ROHS",
    lcsc: 22461592,
    mfr: "LM555CN",
    package: "DIP-8",
    price: 0.141,
  })
})

test("GET /api/search with search query 'red led' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=1&q=red%20led")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  expect(res.data.components[0]).toMatchObject({
    description: "-40℃~+85℃ Red 0603 LED Indication - Discrete ROHS",
    lcsc: 2286,
    mfr: "KT-0603R",
    package: "0603",
    price: 0.005314286,
  })
})
