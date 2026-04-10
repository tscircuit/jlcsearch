import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /mosfets/list with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/mosfets/list?json=true&package=SOT-23")

  expect(res.data).toHaveProperty("mosfets")
  expect(Array.isArray(res.data.mosfets)).toBe(true)

  // Verify all returned MOSFETs have the specified package
  for (const mosfet of res.data.mosfets) {
    expect(mosfet.package).toBe("SOT-23")
  }
})
