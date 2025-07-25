import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /analog_switches/list with json param returns switch data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/analog_switches/list?json=true")
  expect(res.data).toHaveProperty("switches")
  expect(Array.isArray(res.data.switches)).toBe(true)
  if (res.data.switches.length > 0) {
    const sw = res.data.switches[0]
    expect(sw).toHaveProperty("lcsc")
    expect(sw).toHaveProperty("mfr")
    expect(sw).toHaveProperty("package")
    expect(sw).toHaveProperty("num_channels")
    expect(sw).toHaveProperty("has_spi")
    expect(typeof sw.lcsc).toBe("number")
    expect(typeof sw.has_spi).toBe("boolean")
    expect(typeof sw.has_i2c).toBe("boolean")
  }
})
