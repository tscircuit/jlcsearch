import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /microcontrollers/list with json param returns microcontroller data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/microcontrollers/list?json=true")
  expect(res.data).toHaveProperty("microcontrollers")
  expect(Array.isArray(res.data.microcontrollers)).toBe(true)
  if (res.data.microcontrollers.length > 0) {
    const mcu = res.data.microcontrollers[0]
    expect(mcu).toHaveProperty("lcsc")
    expect(mcu).toHaveProperty("mfr")
    expect(mcu).toHaveProperty("package")
    expect(mcu).toHaveProperty("cpu_core")
    expect(mcu).toHaveProperty("cpu_speed_hz")
    expect(mcu).toHaveProperty("has_uart")
    expect(typeof mcu.lcsc).toBe("number")
    expect(typeof mcu.has_uart).toBe("boolean")
    expect(typeof mcu.has_i2c).toBe("boolean")
  }
})
