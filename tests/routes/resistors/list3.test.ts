import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /resistors/list with resistance filter allows small rounding error", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/resistors/list?json=true&resistance=1k")

  expect(res.data).toHaveProperty("resistors")
  expect(Array.isArray(res.data.resistors)).toBe(true)

  for (const resistor of res.data.resistors) {
    const delta = Math.abs(resistor.resistance - 1000)
    expect(delta).toBeLessThanOrEqual(1000 * 0.0001 + 1e-9)
  }
})
