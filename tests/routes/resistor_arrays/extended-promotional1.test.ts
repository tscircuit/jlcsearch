import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /resistor_arrays/list JSON response includes is_extended_promotional field", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/resistor_arrays/list?json=true")

  expect(res.status).toBe(200)
  expect(res.data).toHaveProperty("resistor_arrays")
  expect(Array.isArray(res.data.resistor_arrays)).toBe(true)

  if (res.data.resistor_arrays.length > 0) {
    const resistorArray = res.data.resistor_arrays[0]
    expect(resistorArray).toHaveProperty("is_extended_promotional")
    expect(typeof resistorArray.is_extended_promotional).toBe("boolean")
  }
})
