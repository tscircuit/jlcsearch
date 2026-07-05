import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

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
