import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

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
