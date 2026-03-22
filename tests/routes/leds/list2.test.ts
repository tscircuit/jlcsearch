import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /leds/list with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/leds/list?json=true&package=0603")

  expect(res.data).toHaveProperty("leds")
  expect(Array.isArray(res.data.leds)).toBe(true)

  // Verify all returned LEDs have the specified package
  for (const led of res.data.leds) {
    expect(led.package).toBe("0603")
  }
})
