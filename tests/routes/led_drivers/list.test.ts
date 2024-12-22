import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /led_drivers/list with json param returns LED driver data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/led_drivers/list?json=true")

  expect(res.data).toHaveProperty("led_drivers")
  expect(Array.isArray(res.data.led_drivers)).toBe(true)

  // Check structure of first LED driver if array not empty
  if (res.data.led_drivers.length > 0) {
    const driver = res.data.led_drivers[0]
    expect(driver).toHaveProperty("lcsc")
    expect(driver).toHaveProperty("mfr")
    expect(driver).toHaveProperty("description")
    expect(driver).toHaveProperty("stock")
    expect(driver).toHaveProperty("price1")
    expect(driver).toHaveProperty("in_stock")
    expect(driver).toHaveProperty("package")
    expect(driver).toHaveProperty("supply_voltage_min")
    expect(driver).toHaveProperty("supply_voltage_max")
    expect(driver).toHaveProperty("output_current_max")
    expect(driver).toHaveProperty("channel_count")
    expect(driver).toHaveProperty("dimming_method")
    expect(driver).toHaveProperty("efficiency_percent")
    expect(typeof driver.lcsc).toBe("number")
  }
})

test("GET /led_drivers/list with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/led_drivers/list?json=true&package=SOP-8")

  expect(res.data).toHaveProperty("led_drivers")
  expect(Array.isArray(res.data.led_drivers)).toBe(true)

  // Verify all returned LED drivers have the specified package
  for (const driver of res.data.led_drivers) {
    expect(driver.package).toBe("SOP-8")
  }
})

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
