import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /capacitors/list returns is_extended_promotional boolean field", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/capacitors/list?json=true")

  expect(res.data).toHaveProperty("capacitors")
  expect(Array.isArray(res.data.capacitors)).toBe(true)

  if (res.data.capacitors.length > 0) {
    const capacitor = res.data.capacitors[0]
    expect(capacitor).toHaveProperty("is_extended_promotional")
    expect(typeof capacitor.is_extended_promotional).toBe("boolean")
  }
})
