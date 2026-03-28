import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /resistor_arrays/list with is_extended_promotional filter does not error", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get(
    "/resistor_arrays/list?json=true&is_extended_promotional=true",
  )

  expect(res.status).toBe(200)
  expect(res.data).toHaveProperty("resistor_arrays")
  expect(Array.isArray(res.data.resistor_arrays)).toBe(true)
})
