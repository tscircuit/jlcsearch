import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

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
