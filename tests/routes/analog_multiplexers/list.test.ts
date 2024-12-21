import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /analog_multiplexers/list with json param returns multiplexer data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/analog_multiplexers/list?json=true")
  expect(res.data).toHaveProperty("multiplexers")
  expect(Array.isArray(res.data.multiplexers)).toBe(true)
  if (res.data.multiplexers.length > 0) {
    const mux = res.data.multiplexers[0]
    expect(mux).toHaveProperty("lcsc")
    expect(mux).toHaveProperty("mfr")
    expect(mux).toHaveProperty("package")
    expect(mux).toHaveProperty("num_channels")
    expect(mux).toHaveProperty("has_spi")
    expect(typeof mux.lcsc).toBe("number")
    expect(typeof mux.has_spi).toBe("boolean")
    expect(typeof mux.has_i2c).toBe("boolean")
  }
})
