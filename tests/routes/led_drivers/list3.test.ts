import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /led_drivers/list with voltage filter returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with voltage range filter
  const res = await axios.get(
    "/led_drivers/list?json=true&supply_voltage_min=3.3&supply_voltage_max=5",
  )

  expect(res.data).toHaveProperty("led_drivers")
  expect(Array.isArray(res.data.led_drivers)).toBe(true)

  // Verify all returned LED drivers are within voltage range
  for (const driver of res.data.led_drivers) {
    if (
      driver.supply_voltage_min !== null &&
      driver.supply_voltage_max !== null
    ) {
      expect(driver.supply_voltage_min).toBeGreaterThanOrEqual(3.3)
      expect(driver.supply_voltage_max).toBeLessThanOrEqual(5)
    }
  }
})
