import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /gas_sensors/list with measurement filter returns filtered data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/gas_sensors/list", {
    params: {
      json: true,
      measurement: "oxygen",
    },
  })

  expect(res.data).toHaveProperty("gas_sensors")
  expect(Array.isArray(res.data.gas_sensors)).toBe(true)

  for (const sensor of res.data.gas_sensors) {
    expect(sensor.measures_oxygen).toBe(true)
  }
})
