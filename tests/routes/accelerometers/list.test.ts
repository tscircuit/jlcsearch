import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /accelerometers/list with json param returns accelerometer data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/accelerometers/list?json=true")
  expect(res.data).toHaveProperty("accelerometers")
  expect(Array.isArray(res.data.accelerometers)).toBe(true)
  if (res.data.accelerometers.length > 0) {
    const accel = res.data.accelerometers[0]
    expect(accel).toHaveProperty("lcsc")
    expect(accel).toHaveProperty("mfr")
    expect(accel).toHaveProperty("package")
    expect(accel).toHaveProperty("has_spi")
    expect(typeof accel.lcsc).toBe("number")
    expect(typeof accel.has_spi).toBe("boolean")
    expect(typeof accel.has_i2c).toBe("boolean")
  }
})
