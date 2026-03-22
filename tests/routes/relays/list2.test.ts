import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /relays/list with type filter returns filtered data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/relays/list?json=true&relay_type=Reed Relays")

  expect(res.data).toHaveProperty("relays")
  expect(Array.isArray(res.data.relays)).toBe(true)

  for (const r of res.data.relays) {
    expect(r.relay_type).toBe("Reed Relays")
  }
})
