import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /switches/list with json param returns switch data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/switches/list?json=true")

  expect(res.data).toHaveProperty("switches")
  expect(Array.isArray(res.data.switches)).toBe(true)

  if (res.data.switches.length > 0) {
    const sw = res.data.switches[0]
    expect(sw).toHaveProperty("lcsc")
    expect(sw).toHaveProperty("mfr")
    expect(sw).toHaveProperty("package")
    expect(sw).toHaveProperty("pin_count")
    expect(sw).toHaveProperty("switch_type")
    expect(typeof sw.lcsc).toBe("number")
  }
})
