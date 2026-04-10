import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

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
