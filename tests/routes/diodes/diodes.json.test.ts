import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /diodes/diodes.json returns diode data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/diodes/diodes.json")

  expect(res.data).toHaveProperty("diodes")
  expect(Array.isArray(res.data.diodes)).toBe(true)

  // Check structure of first diode if array not empty
  if (res.data.diodes.length > 0) {
    const diode = res.data.diodes[0]
    expect(diode).toHaveProperty("lcsc")
    expect(diode).toHaveProperty("mfr")
    expect(diode).toHaveProperty("package")
    expect(diode).toHaveProperty("diode_type")
    expect(typeof diode.lcsc).toBe("number")
  }
})

test("GET /diodes/diodes.json with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/diodes/diodes.json?package=SOD-123")

  expect(res.data).toHaveProperty("diodes")
  expect(Array.isArray(res.data.diodes)).toBe(true)

  // Verify all returned diodes have the specified package
  for (const diode of res.data.diodes) {
    expect(diode.package).toBe("SOD-123")
  }
})
