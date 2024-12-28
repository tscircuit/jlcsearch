import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /led_with_ic/list.json with json param returns LED with IC data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/led_with_ic/list.json?json=true")

  expect(res.data).toHaveProperty("leds_with_ic")
  expect(Array.isArray(res.data.leds_with_ic)).toBe(true)

  // Check structure of first LED with IC if array not empty
  if (res.data.leds_with_ic.length > 0) {
    const ledWithIC = res.data.leds_with_ic[0]
    expect(ledWithIC).toHaveProperty("lcsc")
    expect(ledWithIC).toHaveProperty("mfr")
    expect(ledWithIC).toHaveProperty("package")
    expect(ledWithIC).toHaveProperty("description")
    expect(ledWithIC).toHaveProperty("stock")
    expect(ledWithIC).toHaveProperty("price1")

    expect(typeof ledWithIC.lcsc).toBe("number")
    expect(typeof ledWithIC.mfr).toBe("string")
    expect(typeof ledWithIC.package).toBe("string")
    expect(typeof ledWithIC.description).toBe("string")
    expect(typeof ledWithIC.stock).toBe("number")
    expect(typeof ledWithIC.price1).toBe("number")
  }
})

test("GET /led_with_ic/list.json with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/led_with_ic/list.json?json=true&package=0603")

  expect(res.data).toHaveProperty("leds_with_ic")
  expect(Array.isArray(res.data.leds_with_ic)).toBe(true)

  // Verify all returned LEDs with IC have the specified package
  for (const ledWithIC of res.data.leds_with_ic) {
    expect(ledWithIC.package).toBe("0603")
  }

  // Test with color filter
  const colorRes = await axios.get("/led_with_ic/list.json?json=true&color=RED")

  expect(colorRes.data).toHaveProperty("leds_with_ic")
  expect(Array.isArray(colorRes.data.leds_with_ic)).toBe(true)

  // Verify all returned LEDs with IC have the specified color
  for (const ledWithIC of colorRes.data.leds_with_ic) {
    expect(ledWithIC.color).toBe("RED")
  }
})
