import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /gas_sensors/list with json param returns gas sensor data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/gas_sensors/list?json=true")
  expect(res.data).toHaveProperty("gas_sensors")
  expect(Array.isArray(res.data.gas_sensors)).toBe(true)
  if (res.data.gas_sensors.length > 0) {
    const sensor = res.data.gas_sensors[0]
    expect(sensor).toHaveProperty("lcsc")
    expect(sensor).toHaveProperty("mfr")
    expect(sensor).toHaveProperty("package")
    expect(sensor).toHaveProperty("measures_oxygen")
    expect(typeof sensor.measures_oxygen).toBe("boolean")
  }
})
