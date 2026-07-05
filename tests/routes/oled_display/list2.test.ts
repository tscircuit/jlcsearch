import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /oled_display/list.json with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/oled_display/list.json?json=true&package=QFN32")

  expect(res.data).toHaveProperty("oled_displays")
  expect(Array.isArray(res.data.oled_displays)).toBe(true)

  // Verify all returned OLED Displays have the specified package
  for (const oledDisplay of res.data.oled_displays) {
    expect(oledDisplay.package).toBe("QFN32")
  }

  // Test with protocol filter
  const protocolRes = await axios.get(
    "/oled_display/list.json?json=true&protocol=I2C",
  )

  expect(protocolRes.data).toHaveProperty("oled_displays")
  expect(Array.isArray(protocolRes.data.oled_displays)).toBe(true)

  // Verify all returned OLED Displays have the specified protocol
  for (const oledDisplay of protocolRes.data.oled_displays) {
    expect(oledDisplay.protocol).toBe("I2C")
  }
})
