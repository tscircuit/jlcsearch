import { expect, test } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /imus/list with json param returns IMU data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/imus/list?json=true")

  expect(res.data).toHaveProperty("imus")
  expect(Array.isArray(res.data.imus)).toBe(true)

  if (res.data.imus.length > 0) {
    const imu = res.data.imus[0]
    expect(["accelerometer", "gyroscope"]).toContain(imu.type)
    expect(imu).toHaveProperty("lcsc")
    expect(imu).toHaveProperty("mfr")
    expect(imu).toHaveProperty("package")
    expect(imu).toHaveProperty("has_spi")
    expect(typeof imu.lcsc).toBe("number")
    expect(typeof imu.has_spi).toBe("boolean")
    expect(typeof imu.has_i2c).toBe("boolean")
  }
})

test("GET /imus/list supports interface filtering", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/imus/list?json=true&interface=i2c")

  expect(res.data).toHaveProperty("imus")
  for (const imu of res.data.imus) {
    expect(imu.has_i2c).toBe(true)
  }
})
