import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /capacitors/list with capacitance filter allows small rounding error", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/capacitors/list?json=true&capacitance=10u")

  expect(res.data).toHaveProperty("capacitors")
  expect(Array.isArray(res.data.capacitors)).toBe(true)

  for (const capacitor of res.data.capacitors) {
    const delta = Math.abs(capacitor.capacitance - 10e-6)
    expect(delta).toBeLessThanOrEqual(10e-6 * 0.0001 + 1e-12)
  }
})
