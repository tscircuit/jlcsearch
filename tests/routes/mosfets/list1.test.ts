import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /mosfets/list with json param returns MOSFET data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/mosfets/list?json=true")

  expect(res.data).toHaveProperty("mosfets")
  expect(Array.isArray(res.data.mosfets)).toBe(true)

  // Check structure of first MOSFET if array not empty
  if (res.data.mosfets.length > 0) {
    const mosfet = res.data.mosfets[0]
    expect(mosfet).toHaveProperty("lcsc")
    expect(mosfet).toHaveProperty("mfr")
    expect(mosfet).toHaveProperty("description")
    expect(mosfet).toHaveProperty("stock")
    expect(mosfet).toHaveProperty("price1")
    expect(mosfet).toHaveProperty("in_stock")
    expect(mosfet).toHaveProperty("package")
    expect(mosfet).toHaveProperty("drain_source_voltage")
    expect(mosfet).toHaveProperty("continuous_drain_current")
    expect(mosfet).toHaveProperty("gate_threshold_voltage")
    expect(mosfet).toHaveProperty("power_dissipation")
    expect(typeof mosfet.lcsc).toBe("number")
  }
})
