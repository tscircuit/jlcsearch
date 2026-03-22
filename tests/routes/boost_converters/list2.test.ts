import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /boost_converters/list with package filter returns filtered data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get(
    "/boost_converters/list?json=true&package=SOT-23-6",
  )
  expect(res.data).toHaveProperty("boost_converters")
  for (const conv of res.data.boost_converters) {
    expect(conv.package).toBe("SOT-23-6")
  }
})
