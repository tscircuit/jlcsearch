import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /boost_converters/list with json param returns converter data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/boost_converters/list?json=true")

  expect(res.data).toHaveProperty("boost_converters")
  expect(Array.isArray(res.data.boost_converters)).toBe(true)

  if (res.data.boost_converters.length > 0) {
    const conv = res.data.boost_converters[0]
    expect(conv).toHaveProperty("lcsc")
    expect(conv).toHaveProperty("mfr")
    expect(conv).toHaveProperty("package")
    expect(typeof conv.lcsc).toBe("number")
  }
})
