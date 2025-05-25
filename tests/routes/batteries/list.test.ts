import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /batteries/list.json with json param returns battery data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/batteries/list.json?json=true")

  expect(res.data).toHaveProperty("batteries")
  expect(Array.isArray(res.data.batteries)).toBe(true)

  // check structure of first battery if array not empty
  if (res.data.batteries.length > 0) {
    const battery = res.data.batteries[0]
    expect(battery).toHaveProperty("lcsc")
    expect(battery).toHaveProperty("mfr")
    expect(battery).toHaveProperty("package")
    expect(battery).toHaveProperty("description")
    expect(battery).toHaveProperty("stock")
    expect(battery).toHaveProperty("price1")
    expect(battery).toHaveProperty("capacity")
    expect(battery).toHaveProperty("voltage")
    expect(battery).toHaveProperty("chemistry")
    expect(battery).toHaveProperty("is_rechargeable")

    expect(typeof battery.lcsc).toBe("number")
    expect(typeof battery.mfr).toBe("string")
    expect(typeof battery.package).toBe("string")
    expect(typeof battery.description).toBe("string")
    expect(typeof battery.stock).toBe("number")
    expect(typeof battery.price1).toBe("number")
    expect(typeof battery.capacity).toBe("number")
    expect(typeof battery.voltage).toBe("number")
    expect(typeof battery.chemistry).toBe("string")
    expect(typeof battery.is_rechargeable).toBe("boolean")
  }
})

test("GET /batteries/list.json with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const packageRes = await axios.get(
    "/batteries/list.json?json=true&package=AA",
  )
  expect(packageRes.data).toHaveProperty("batteries")
  expect(Array.isArray(packageRes.data.batteries)).toBe(true)

  // Verify all returned batteries have the specified package
  for (const battery of packageRes.data.batteries) {
    expect(battery.package).toBe("AA")
  }

  // Test with chemistry filter
  const chemistryRes = await axios.get(
    "/batteries/list.json?json=true&chemistry=Li-ion",
  )
  expect(chemistryRes.data).toHaveProperty("batteries")
  expect(Array.isArray(chemistryRes.data.batteries)).toBe(true)

  // Verify all returned batteries have the specified chemistry
  for (const battery of chemistryRes.data.batteries) {
    expect(battery.chemistry).toBe("Li-ion")
  }

  // Test with voltage filter
  const voltageRes = await axios.get(
    "/batteries/list.json?json=true&voltage=3.7",
  )
  expect(voltageRes.data).toHaveProperty("batteries")
  expect(Array.isArray(voltageRes.data.batteries)).toBe(true)

  // Verify all returned batteries have the specified voltage
  for (const battery of voltageRes.data.batteries) {
    expect(battery.voltage).toBe(3.7)
  }
})
