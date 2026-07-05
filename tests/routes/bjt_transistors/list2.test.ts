import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /bjt_transistors/list with package filter returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/bjt_transistors/list?json=true&package=SOT-23")

  expect(res.data).toHaveProperty("bjt_transistors")
  expect(Array.isArray(res.data.bjt_transistors)).toBe(true)

  // Verify all returned BJTs have the specified package
  for (const bjt of res.data.bjt_transistors) {
    expect(bjt.package).toBe("SOT-23")
  }
})
