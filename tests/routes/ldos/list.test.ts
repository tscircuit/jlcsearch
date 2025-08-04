import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /ldos/list with json param returns ldo data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/ldos/list?json=true")
  expect(res.data).toHaveProperty("ldos")
  expect(Array.isArray(res.data.ldos)).toBe(true)
  if (res.data.ldos.length > 0) {
    const ldo = res.data.ldos[0]
    expect(ldo).toHaveProperty("lcsc")
    expect(ldo).toHaveProperty("mfr")
    expect(ldo).toHaveProperty("package")
    expect(ldo).toHaveProperty("output_type")
    expect(ldo).toHaveProperty("is_positive")
    expect(typeof ldo.lcsc).toBe("number")
    expect(typeof ldo.is_positive).toBe("boolean")
  }
})
