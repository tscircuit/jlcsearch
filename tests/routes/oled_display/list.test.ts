import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /oled_display/list.json with json param returns OLED Display data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/oled_display/list.json?json=true")

  expect(res.data).toHaveProperty("oled_displays")
  expect(Array.isArray(res.data.oled_displays)).toBe(true)

  // check structure of first OLED Display if array not empty
  if (res.data.oled_displays.length > 0) {
    const oledDisplay = res.data.oled_displays[0]
    expect(oledDisplay).toHaveProperty("lcsc")
    expect(oledDisplay).toHaveProperty("mfr")
    expect(oledDisplay).toHaveProperty("package")
    expect(oledDisplay).toHaveProperty("description")
    expect(oledDisplay).toHaveProperty("stock")
    expect(oledDisplay).toHaveProperty("price1")
    expect(oledDisplay).toHaveProperty("protocol")

    expect(typeof oledDisplay.lcsc).toBe("number")
    expect(typeof oledDisplay.mfr).toBe("string")
    expect(typeof oledDisplay.package).toBe("string")
    expect(typeof oledDisplay.description).toBe("string")
    expect(typeof oledDisplay.stock).toBe("number")
    expect(typeof oledDisplay.price1).toBe("number")
    if (oledDisplay.protocol) {
      expect(typeof oledDisplay.protocol).toBe("string")
    }
  }
})

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
