import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /bjt_transistors/list with json param returns BJT transistor data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/bjt_transistors/list?json=true")

  expect(res.data).toHaveProperty("bjt_transistors")
  expect(Array.isArray(res.data.bjt_transistors)).toBe(true)

  // Check structure of first BJT transistor if array not empty
  if (res.data.bjt_transistors.length > 0) {
    const bjt = res.data.bjt_transistors[0]

    // Required fields
    expect(bjt).toHaveProperty("lcsc")
    expect(bjt).toHaveProperty("mfr")
    expect(bjt).toHaveProperty("description")
    expect(bjt).toHaveProperty("stock")
    expect(bjt).toHaveProperty("price1")
    expect(bjt).toHaveProperty("in_stock")
    expect(bjt).toHaveProperty("package")

    // BJT specific fields
    expect(bjt).toHaveProperty("current_gain")
    expect(bjt).toHaveProperty("collector_current")
    expect(bjt).toHaveProperty("collector_emitter_voltage")
    expect(bjt).toHaveProperty("transition_frequency")
    expect(bjt).toHaveProperty("power")
    expect(bjt).toHaveProperty("temperature_range")

    // Check types
    expect(typeof bjt.lcsc).toBe("number")
    expect(typeof bjt.mfr).toBe("string")
    expect(typeof bjt.description).toBe("string")
    expect(typeof bjt.stock).toBe("number")
    expect(bjt.price1 === null || typeof bjt.price1 === "number").toBe(true)
    expect(typeof bjt.in_stock).toBe("boolean")
    expect(typeof bjt.package).toBe("string")
  }
})

test("GET /bjt_transistors/list with package filter returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/bjt_transistors/list?json=true&package=SOT-23")

  expect(res.data).toHaveProperty("bjt_transistors")
  expect(Array.isArray(res.data.bjt_transistors)).toBe(true)

  // Verify all returned BJTs have the specified package
  for (const bjt of res.data.bjt_transistors) {
    expect(bjt.package).toBe("SOT-23")
  }
})

test("GET /bjt_transistors/list with current and voltage filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with current and voltage range filters
  const res = await axios.get(
    "/bjt_transistors/list?json=true&collector_current_min=1&collector_emitter_voltage_min=20",
  )

  expect(res.data).toHaveProperty("bjt_transistors")
  expect(Array.isArray(res.data.bjt_transistors)).toBe(true)

  // Verify all returned BJTs meet the criteria
  for (const bjt of res.data.bjt_transistors) {
    if (bjt.collector_current !== null) {
      expect(bjt.collector_current).toBeGreaterThanOrEqual(1)
    }
    if (bjt.collector_emitter_voltage !== null) {
      expect(bjt.collector_emitter_voltage).toBeGreaterThanOrEqual(20)
    }
  }
})
