import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /diodes/list with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/diodes/list?json=true&package=SOD-123")

  expect(res.data).toHaveProperty("diodes")
  expect(Array.isArray(res.data.diodes)).toBe(true)

  // Verify all returned diodes have the specified package
  for (const diode of res.data.diodes) {
    expect(diode.package).toBe("SOD-123")
  }
})
