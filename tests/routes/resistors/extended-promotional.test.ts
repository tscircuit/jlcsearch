import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /resistors/list returns is_extended_promotional field in response", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/resistors/list?json=true")

  expect(res.data).toHaveProperty("resistors")
  expect(Array.isArray(res.data.resistors)).toBe(true)

  if (res.data.resistors.length > 0) {
    const resistor = res.data.resistors[0]
    expect(resistor).toHaveProperty("is_extended_promotional")
    expect(typeof resistor.is_extended_promotional).toBe("boolean")
  }
})

test("GET /resistors/list with is_extended_promotional filter returns array", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get(
    "/resistors/list?json=true&is_extended_promotional=true",
  )

  expect(res.data).toHaveProperty("resistors")
  expect(Array.isArray(res.data.resistors)).toBe(true)

  // All returned resistors should have is_extended_promotional = true
  for (const resistor of res.data.resistors) {
    expect(resistor.is_extended_promotional).toBe(true)
  }
})
