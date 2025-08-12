import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /potentiometers/list with json param returns potentiometer data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/potentiometers/list?json=true")

  expect(res.data).toHaveProperty("potentiometers")
  expect(Array.isArray(res.data.potentiometers)).toBe(true)

  if (res.data.potentiometers.length > 0) {
    const pot = res.data.potentiometers[0]
    expect(pot).toHaveProperty("lcsc")
    expect(pot).toHaveProperty("mfr")
    expect(pot).toHaveProperty("package")
    expect(pot).toHaveProperty("maxResistance")
    expect(pot).toHaveProperty("pinVariant")
  }
})

test("GET /potentiometers/list with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get(
    "/potentiometers/list?json=true&pinVariant=three_pin&maxResistance=10k",
  )

  expect(res.data).toHaveProperty("potentiometers")
  expect(Array.isArray(res.data.potentiometers)).toBe(true)

  for (const pot of res.data.potentiometers) {
    expect(pot.pinVariant).toBe("three_pin")
    const delta = Math.abs(pot.maxResistance - 10000)
    expect(delta).toBeLessThanOrEqual(10000 * 0.0001 + 1e-9)
  }
})
