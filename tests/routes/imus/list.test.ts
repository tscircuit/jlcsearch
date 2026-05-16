import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /imus/list with json param returns imu data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/imus/list?json=true")
  expect(res.data).toHaveProperty("imus")
  expect(Array.isArray(res.data.imus)).toBe(true)
  if (res.data.imus.length > 0) {
    const imu = res.data.imus[0]
    expect(imu).toHaveProperty("lcsc")
    expect(imu).toHaveProperty("mfr")
    expect(imu).toHaveProperty("package")
    expect(imu).toHaveProperty("has_spi")
    expect(imu).toHaveProperty("has_accelerometer")
    expect(imu).toHaveProperty("has_gyroscope")
    expect(imu).toHaveProperty("has_magnetometer")
    expect(typeof imu.lcsc).toBe("number")
    expect(typeof imu.has_spi).toBe("boolean")
    expect(typeof imu.has_i2c).toBe("boolean")
    expect(typeof imu.has_accelerometer).toBe("boolean")
    expect(typeof imu.has_gyroscope).toBe("boolean")
  }
})
