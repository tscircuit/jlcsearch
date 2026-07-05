import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /led_with_ic/list.json with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get(
    "/led_with_ic/list.json?json=true&package=SMD5050",
  )

  expect(res.data).toHaveProperty("leds_with_ic")
  expect(Array.isArray(res.data.leds_with_ic)).toBe(true)

  // Verify all returned LEDs with IC have the specified package
  for (const ledWithIC of res.data.leds_with_ic) {
    expect(ledWithIC.package).toBe("SMD5050")
  }

  // Test with color filter
  const colorRes = await axios.get("/led_with_ic/list.json?json=true&color=RGB")

  expect(colorRes.data).toHaveProperty("leds_with_ic")
  expect(Array.isArray(colorRes.data.leds_with_ic)).toBe(true)

  // Verify all returned LEDs with IC have the specified color
  for (const ledWithIC of colorRes.data.leds_with_ic) {
    expect(ledWithIC.color).toBe("RGB")
  }
})
