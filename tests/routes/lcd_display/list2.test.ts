import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /lcd_display/list.json with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/lcd_display/list.json?json=true&package=COB")
  expect(res.data).toHaveProperty("lcd_displays")
  expect(Array.isArray(res.data.lcd_displays)).toBe(true)

  // Verify all returned LCD Displays have the specified package
  for (const lcdDisplay of res.data.lcd_displays) {
    expect(lcdDisplay.package).toBe("COB")
  }

  // Test with display type filter
  const typeRes = await axios.get(
    "/lcd_display/list.json?json=true&display_type=TFT",
  )
  expect(typeRes.data).toHaveProperty("lcd_displays")
  expect(Array.isArray(typeRes.data.lcd_displays)).toBe(true)

  // Verify all returned LCD Displays have the specified display type
  for (const lcdDisplay of typeRes.data.lcd_displays) {
    expect(lcdDisplay.display_type).toBe("TFT")
  }
})
