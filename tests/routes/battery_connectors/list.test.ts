import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /battery_connectors/list.json with json param returns Battery Connector data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/battery_connectors/list.json?json=true")

  expect(res.data).toHaveProperty("battery_connectors")
  expect(Array.isArray(res.data.battery_connectors)).toBe(true)

  // Check structure of first battery connector if array is not empty
  if (res.data.battery_connectors.length > 0) {
    const batteryConnector = res.data.battery_connectors[0]

    // Required fields
    expect(batteryConnector).toHaveProperty("lcsc")
    expect(batteryConnector).toHaveProperty("mfr")
    expect(batteryConnector).toHaveProperty("package")
    expect(batteryConnector).toHaveProperty("description")
    expect(batteryConnector).toHaveProperty("stock")
    expect(batteryConnector).toHaveProperty("price1")

    // Type checking for required fields
    expect(typeof batteryConnector.lcsc).toBe("number")
    expect(typeof batteryConnector.mfr).toBe("string")
    expect(typeof batteryConnector.package).toBe("string")
    expect(typeof batteryConnector.description).toBe("string")
    expect(typeof batteryConnector.stock).toBe("number")
    expect(typeof batteryConnector.price1).toBe("number")

    // Optional fields
    if (batteryConnector.battery_type) {
      expect(typeof batteryConnector.battery_type).toBe("string")
    }
    if (batteryConnector.number_of_contacts) {
      expect(typeof batteryConnector.number_of_contacts).toBe("number")
    }
    if (batteryConnector.operating_temperature) {
      expect(typeof batteryConnector.operating_temperature).toBe("string")
    }
  }
})

test("GET /battery_connectors/list.json with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get(
    "/battery_connectors/list.json?json=true&package=SMD",
  )
  expect(res.data).toHaveProperty("battery_connectors")
  expect(Array.isArray(res.data.battery_connectors)).toBe(true)

  // Verify all returned battery connectors have the specified package
  for (const connector of res.data.battery_connectors) {
    expect(connector.package).toBe("SMD")
  }

  // Test with battery type filter
  const typeRes = await axios.get(
    "/battery_connectors/list.json?json=true&battery_type=Li-ion",
  )
  expect(typeRes.data).toHaveProperty("battery_connectors")
  expect(Array.isArray(typeRes.data.battery_connectors)).toBe(true)

  // Verify all returned battery connectors have the specified battery type
  for (const connector of typeRes.data.battery_connectors) {
    expect(connector.battery_type).toBe("Li-ion")
  }

  // Test with number of contacts filter
  const contactsRes = await axios.get(
    "/battery_connectors/list.json?json=true&number_of_contacts=2",
  )
  expect(contactsRes.data).toHaveProperty("battery_connectors")
  expect(Array.isArray(contactsRes.data.battery_connectors)).toBe(true)

  // Verify all returned battery connectors have the specified number of contacts
  for (const connector of contactsRes.data.battery_connectors) {
    expect(connector.number_of_contacts).toBe(2)
  }
})
