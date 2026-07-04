import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /pinheaders/list aliases the headers API for sourcing", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/pinheaders/list", {
    params: {
      json: true,
      pitch_mm: 2.54,
      pin_count: 4,
    },
  })

  expect(res.data).toHaveProperty("headers")
  expect(Array.isArray(res.data.headers)).toBe(true)
  expect(res.data.headers.length).toBeGreaterThan(0)

  for (const header of res.data.headers) {
    expect(header.pitch_mm).toBe(2.54)
    expect(header.num_pins).toBe(4)
  }
})

test("GET /pinheaders/list.json returns header data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/pinheaders/list.json", {
    params: {
      pitch: "2.54",
      num_pins: 4,
    },
  })

  expect(res.data).toHaveProperty("headers")
  expect(Array.isArray(res.data.headers)).toBe(true)
})
