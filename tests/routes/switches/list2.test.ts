import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /switches/list with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get(
    "/switches/list?json=true&circuit=SPDT&package=SMD&pin_count=2",
  )

  expect(res.data).toHaveProperty("switches")
  expect(Array.isArray(res.data.switches)).toBe(true)

  for (const sw of res.data.switches) {
    if (sw.circuit) {
      expect(sw.circuit).toBe("SPDT")
    }
    if (sw.package) {
      expect(sw.package).toBe("SMD")
    }
    if (sw.pin_count) {
      expect(sw.pin_count).toBe(2)
    }
  }
})
