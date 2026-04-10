import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

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
