import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /voltage_regulators/list with json param returns regulator data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/voltage_regulators/list?json=true")
  expect(res.data).toHaveProperty("regulators")
  expect(Array.isArray(res.data.regulators)).toBe(true)
  if (res.data.regulators.length > 0) {
    const regulator = res.data.regulators[0]
    expect(regulator).toHaveProperty("lcsc")
    expect(regulator).toHaveProperty("mfr")
    expect(regulator).toHaveProperty("package")
    expect(regulator).toHaveProperty("output_type")
    expect(regulator).toHaveProperty("is_low_dropout")
    expect(regulator).toHaveProperty("is_positive")
    expect(typeof regulator.lcsc).toBe("number")
    expect(typeof regulator.is_low_dropout).toBe("boolean")
    expect(typeof regulator.is_positive).toBe("boolean")
  }
})
