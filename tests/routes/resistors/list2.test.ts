import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /resistors/list with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/resistors/list?json=true&package=0603")

  expect(res.data).toHaveProperty("resistors")
  expect(Array.isArray(res.data.resistors)).toBe(true)

  // Verify all returned resistors have the specified package
  for (const resistor of res.data.resistors) {
    expect(resistor.package).toBe("0603")
  }
})
