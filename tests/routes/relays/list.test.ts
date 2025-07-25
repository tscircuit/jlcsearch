import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /relays/list with json param returns relay data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/relays/list?json=true")

  expect(res.data).toHaveProperty("relays")
  expect(Array.isArray(res.data.relays)).toBe(true)

  if (res.data.relays.length > 0) {
    const r = res.data.relays[0]
    expect(r).toHaveProperty("lcsc")
    expect(r).toHaveProperty("mfr")
    expect(r).toHaveProperty("package")
    expect(r).toHaveProperty("relay_type")
    expect(typeof r.lcsc).toBe("number")
  }
})

test("GET /relays/list with type filter returns filtered data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/relays/list?json=true&relay_type=Reed Relays")

  expect(res.data).toHaveProperty("relays")
  expect(Array.isArray(res.data.relays)).toBe(true)

  for (const r of res.data.relays) {
    expect(r.relay_type).toBe("Reed Relays")
  }
})
