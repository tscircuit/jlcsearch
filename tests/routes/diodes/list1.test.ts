import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /diodes/list with json param returns diode data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/diodes/list?json=true")

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
