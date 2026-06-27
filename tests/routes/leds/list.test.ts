import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /leds/list with json param returns LED data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/leds/list?json=true")

  expect(res.data).toHaveProperty("leds")
  expect(Array.isArray(res.data.leds)).toBe(true)

  // Check structure of first LED if array not empty
  if (res.data.leds.length > 0) {
    const led = res.data.leds[0]
    expect(led).toHaveProperty("lcsc")
    expect(led).toHaveProperty("mfr")
    expect(led).toHaveProperty("package")
    if ("color" in led) {
      expect(typeof led.color === "string" || led.color === undefined).toBe(
        true,
      )
    }
    expect(typeof led.lcsc).toBe("number")
  }
})

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
