import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /led_segment_display/list.json with json param returns LED Segment data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/led_segment_display/list.json?json=true")

  expect(res.data).toHaveProperty("led_segment_displays")
  expect(Array.isArray(res.data.led_segment_displays)).toBe(true)

  // Check structure of first LED Segment if array not empty
  if (res.data.led_segment_displays.length > 0) {
    const ledSegment = res.data.led_segment_displays[0]
    expect(ledSegment).toHaveProperty("lcsc")
    expect(ledSegment).toHaveProperty("mfr")
    expect(ledSegment).toHaveProperty("package")
    expect(ledSegment).toHaveProperty("description")
    expect(ledSegment).toHaveProperty("stock")
    expect(ledSegment).toHaveProperty("price1")
    expect(ledSegment).toHaveProperty("positions")
    expect(typeof ledSegment.lcsc).toBe("number")
    expect(typeof ledSegment.mfr).toBe("string")
    expect(typeof ledSegment.package).toBe("string")
    expect(typeof ledSegment.description).toBe("string")
    expect(typeof ledSegment.stock).toBe("number")
    expect(typeof ledSegment.price1).toBe("number")
    if (ledSegment.positions) {
      expect(typeof ledSegment.positions).toBe("string")
    }
    if (ledSegment.type) {
      expect(typeof ledSegment.type).toBe("string")
    }
  }
})

test("GET /led_segment_display/list.json with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get(
    "/led_segment_display/list.json?json=true&package=Plugin",
  )
  expect(res.data).toHaveProperty("led_segment_displays")
  expect(Array.isArray(res.data.led_segment_displays)).toBe(true)

  // Verify all returned LED Segments have the specified package
  for (const ledSegment of res.data.led_segment_displays) {
    expect(ledSegment.package).toBe("Plugin")
  }

  // Test with type filter
  const typeRes = await axios.get(
    "/led_segment_display/list.json?json=true&type=Common Cathode",
  )
  expect(typeRes.data).toHaveProperty("led_segment_displays")
  expect(Array.isArray(typeRes.data.led_segment_displays)).toBe(true)

  // Verify all returned LED Segments have the specified type
  for (const ledSegment of typeRes.data.led_segment_displays) {
    expect(ledSegment.type).toBe("Common Cathode")
  }
})
