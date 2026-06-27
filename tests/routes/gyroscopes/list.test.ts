import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /gyroscopes/list with json param returns gyroscope data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/gyroscopes/list?json=true")
  expect(res.data).toHaveProperty("gyroscopes")
  expect(Array.isArray(res.data.gyroscopes)).toBe(true)
  if (res.data.gyroscopes.length > 0) {
    const gyro = res.data.gyroscopes[0]
    expect(gyro).toHaveProperty("lcsc")
    expect(gyro).toHaveProperty("mfr")
    expect(gyro).toHaveProperty("package")
    expect(gyro).toHaveProperty("has_spi")
    expect(typeof gyro.lcsc).toBe("number")
    expect(typeof gyro.has_spi).toBe("boolean")
    expect(typeof gyro.has_i2c).toBe("boolean")
  }
})
