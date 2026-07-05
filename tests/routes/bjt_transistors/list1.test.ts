import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /bjt_transistors/list with json param returns BJT transistor data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/bjt_transistors/list?json=true")

  expect(res.data).toHaveProperty("bjt_transistors")
  expect(Array.isArray(res.data.bjt_transistors)).toBe(true)

  // Check structure of first BJT transistor if array not empty
  if (res.data.bjt_transistors.length > 0) {
    const bjt = res.data.bjt_transistors[0]

    // Required fields
    expect(bjt).toHaveProperty("lcsc")
    expect(bjt).toHaveProperty("mfr")
    expect(bjt).toHaveProperty("description")
    expect(bjt).toHaveProperty("stock")
    expect(bjt).toHaveProperty("price1")
    expect(bjt).toHaveProperty("in_stock")
    expect(bjt).toHaveProperty("package")

    // BJT specific fields
    expect(bjt).toHaveProperty("current_gain")
    expect(bjt).toHaveProperty("collector_current")
    expect(bjt).toHaveProperty("collector_emitter_voltage")
    expect(bjt).toHaveProperty("transition_frequency")
    expect(bjt).toHaveProperty("power_dissipation")
    expect(bjt).toHaveProperty("temperature_range")

    // Check types
    expect(typeof bjt.lcsc).toBe("number")
    expect(typeof bjt.mfr).toBe("string")
    expect(typeof bjt.description).toBe("string")
    expect(typeof bjt.stock).toBe("number")
    expect(bjt.price1 === null || typeof bjt.price1 === "number").toBe(true)
    expect(typeof bjt.in_stock).toBe("boolean")
    expect(typeof bjt.package).toBe("string")
  }
})
