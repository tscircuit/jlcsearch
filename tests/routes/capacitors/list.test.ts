import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /capacitors/list with json param returns capacitor data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/capacitors/list?json=true")

  expect(res.data).toHaveProperty("capacitors")
  expect(Array.isArray(res.data.capacitors)).toBe(true)

  // Check structure of first capacitor if array not empty
  if (res.data.capacitors.length > 0) {
    const capacitor = res.data.capacitors[0]
    expect(capacitor).toHaveProperty("lcsc")
    expect(capacitor).toHaveProperty("mfr")
    expect(capacitor).toHaveProperty("package")
    expect(capacitor).toHaveProperty("capacitance")
    expect(typeof capacitor.lcsc).toBe("number")
  }
})

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
