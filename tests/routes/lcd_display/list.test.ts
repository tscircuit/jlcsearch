import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /lcd_display/list.json with json param returns LCD Display data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/lcd_display/list.json?json=true")

  expect(res.data).toHaveProperty("lcd_displays")
  expect(Array.isArray(res.data.lcd_displays)).toBe(true)

  // check structure of first LCD Display if array not empty
  if (res.data.lcd_displays.length > 0) {
    const lcdDisplay = res.data.lcd_displays[0]
    expect(lcdDisplay).toHaveProperty("lcsc")
    expect(lcdDisplay).toHaveProperty("mfr")
    expect(lcdDisplay).toHaveProperty("package")
    expect(lcdDisplay).toHaveProperty("description")
    expect(lcdDisplay).toHaveProperty("stock")
    expect(lcdDisplay).toHaveProperty("price1")
    expect(lcdDisplay).toHaveProperty("display_size")

    expect(typeof lcdDisplay.lcsc).toBe("number")
    expect(typeof lcdDisplay.mfr).toBe("string")
    expect(typeof lcdDisplay.package).toBe("string")
    expect(typeof lcdDisplay.description).toBe("string")
    expect(typeof lcdDisplay.stock).toBe("number")
    expect(typeof lcdDisplay.price1).toBe("number")

    if (lcdDisplay.display_size) {
      expect(typeof lcdDisplay.display_size).toBe("string")
    }
    if (lcdDisplay.resolution) {
      expect(typeof lcdDisplay.resolution).toBe("string")
    }
    if (lcdDisplay.display_type) {
      expect(typeof lcdDisplay.display_type).toBe("string")
    }
  }
})

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
