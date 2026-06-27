import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /jst_connectors/list with json param returns data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/jst_connectors/list?json=true")

  expect(res.data).toHaveProperty("jst_connectors")
  expect(Array.isArray(res.data.jst_connectors)).toBe(true)

  if (res.data.jst_connectors.length > 0) {
    const c = res.data.jst_connectors[0]
    expect(c).toHaveProperty("lcsc")
    expect(c).toHaveProperty("mfr")
  }
})

test("GET /jst_connectors/list with pitch filter returns filtered data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/jst_connectors/list?json=true&pitch=2")

  expect(res.data).toHaveProperty("jst_connectors")
  expect(Array.isArray(res.data.jst_connectors)).toBe(true)

  for (const c of res.data.jst_connectors) {
    if (c.pitch_mm !== undefined) {
      expect(c.pitch_mm).toBe(2)
    }
  }
})
