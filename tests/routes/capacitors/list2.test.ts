import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /capacitors/list with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/capacitors/list?json=true&package=0603")

  expect(res.data).toHaveProperty("capacitors")
  expect(Array.isArray(res.data.capacitors)).toBe(true)

  // Verify all returned capacitors have the specified package
  for (const capacitor of res.data.capacitors) {
    expect(capacitor.package).toBe("0603")
  }
})
