import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /buck_boost_converters/list with json param returns converter data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/buck_boost_converters/list?json=true")

  expect(res.data).toHaveProperty("buck_boost_converters")
  expect(Array.isArray(res.data.buck_boost_converters)).toBe(true)

  if (res.data.buck_boost_converters.length > 0) {
    const conv = res.data.buck_boost_converters[0]
    expect(conv).toHaveProperty("lcsc")
    expect(conv).toHaveProperty("mfr")
    expect(conv).toHaveProperty("package")
    expect(typeof conv.lcsc).toBe("number")
  }
})

test("GET /buck_boost_converters/list with package filter returns filtered data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get(
    "/buck_boost_converters/list?json=true&package=SOT-23-6",
  )
  expect(res.data).toHaveProperty("buck_boost_converters")
  for (const conv of res.data.buck_boost_converters) {
    expect(conv.package).toBe("SOT-23-6")
  }
})
