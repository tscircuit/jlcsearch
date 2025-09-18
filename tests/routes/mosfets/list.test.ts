import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /mosfets/list with json param returns MOSFET data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/mosfets/list?json=true")

  expect(res.data).toHaveProperty("mosfets")
  expect(Array.isArray(res.data.mosfets)).toBe(true)

  // Check structure of first MOSFET if array not empty
  if (res.data.mosfets.length > 0) {
    const mosfet = res.data.mosfets[0]
    expect(mosfet).toHaveProperty("lcsc")
    expect(mosfet).toHaveProperty("mfr")
    expect(mosfet).toHaveProperty("description")
    expect(mosfet).toHaveProperty("stock")
    expect(mosfet).toHaveProperty("price1")
    expect(mosfet).toHaveProperty("in_stock")
    expect(mosfet).toHaveProperty("package")
    expect(mosfet).toHaveProperty("drain_source_voltage")
    expect(mosfet).toHaveProperty("continuous_drain_current")
    expect(mosfet).toHaveProperty("gate_threshold_voltage")
    expect(mosfet).toHaveProperty("power_dissipation")
    expect(typeof mosfet.lcsc).toBe("number")
  }
})

test("GET /mosfets/list with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/mosfets/list?json=true&package=SOT-23")

  expect(res.data).toHaveProperty("mosfets")
  expect(Array.isArray(res.data.mosfets)).toBe(true)

  // Verify all returned MOSFETs have the specified package
  for (const mosfet of res.data.mosfets) {
    expect(mosfet.package).toBe("SOT-23")
  }
})

test("GET /mosfets/list with voltage filter returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with voltage range filter
  const res = await axios.get(
    "/mosfets/list?json=true&drain_source_voltage_min=20&drain_source_voltage_max=60",
  )

  expect(res.data).toHaveProperty("mosfets")
  expect(Array.isArray(res.data.mosfets)).toBe(true)

  // Verify all returned MOSFETs are within voltage range
  for (const mosfet of res.data.mosfets) {
    if (mosfet.drain_source_voltage !== null) {
      expect(mosfet.drain_source_voltage).toBeGreaterThanOrEqual(20)
      expect(mosfet.drain_source_voltage).toBeLessThanOrEqual(60)
    }
  }
})

test("GET /mosfets/list returns new properties", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/mosfets/list?json=true")

  expect(res.data).toHaveProperty("mosfets")

  if (res.data.mosfets.length > 0) {
    const mosfet = res.data.mosfets[0]
    expect(mosfet).toHaveProperty("kicad_footprint")
    expect(mosfet).toHaveProperty("jlc_part_number")

    // The value can be null, so we check for either string or null
    if (mosfet.kicad_footprint !== null) {
      expect(typeof mosfet.kicad_footprint).toBe("string")
    }
    if (mosfet.jlc_part_number !== null) {
      expect(typeof mosfet.jlc_part_number).toBe("string")
    }
  }
})
