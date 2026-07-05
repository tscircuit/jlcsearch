import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /pcie_m2_connectors/list with json param returns data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/pcie_m2_connectors/list?json=true")

  expect(res.data).toHaveProperty("pcie_m2_connectors")
  expect(Array.isArray(res.data.pcie_m2_connectors)).toBe(true)

  if (res.data.pcie_m2_connectors.length > 0) {
    const c = res.data.pcie_m2_connectors[0]
    expect(c).toHaveProperty("lcsc")
    expect(c).toHaveProperty("key")
    expect(typeof c.lcsc).toBe("number")
  }
})
