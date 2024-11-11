import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /resistors/list with json param returns resistor data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/resistors/list?json=true")
  
  expect(res.data).toHaveProperty("resistors")
  expect(Array.isArray(res.data.resistors)).toBe(true)
  
  // Check structure of first resistor if array not empty
  if (res.data.resistors.length > 0) {
    const resistor = res.data.resistors[0]
    expect(resistor).toHaveProperty("lcsc")
    expect(resistor).toHaveProperty("mfr")
    expect(resistor).toHaveProperty("package")
    expect(resistor).toHaveProperty("resistance")
    expect(typeof resistor.lcsc).toBe("number")
  }
})

test("GET /resistors/list with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/resistors/list?json=true&package=0603")
  
  expect(res.data).toHaveProperty("resistors")
  expect(Array.isArray(res.data.resistors)).toBe(true)
  
  // Verify all returned resistors have the specified package
  for (const resistor of res.data.resistors) {
    expect(resistor.package).toBe("0603")
  }
})
