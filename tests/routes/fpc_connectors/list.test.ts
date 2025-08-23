import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /fpc_connectors/list with json param returns data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/fpc_connectors/list?json=true")

  expect(res.data).toHaveProperty("fpc_connectors")
  expect(Array.isArray(res.data.fpc_connectors)).toBe(true)

  if (res.data.fpc_connectors.length > 0) {
    const c = res.data.fpc_connectors[0]
    expect(c).toHaveProperty("lcsc")
    expect(c).toHaveProperty("mfr")
    expect(typeof c.lcsc).toBe("number")
  }
})

test("GET /fpc_connectors/list with contact_type filter returns filtered data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get(
    "/fpc_connectors/list?json=true&contact_type=Bottom%20Contact",
  )

  expect(res.data).toHaveProperty("fpc_connectors")
  expect(Array.isArray(res.data.fpc_connectors)).toBe(true)

  for (const c of res.data.fpc_connectors) {
    if (c.contact_type) {
      expect(c.contact_type).toBe("Bottom Contact")
    }
  }
})
