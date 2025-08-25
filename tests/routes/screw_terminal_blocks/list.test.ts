import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /screw_terminal_blocks/list with json param returns data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/screw_terminal_blocks/list?json=true")

  expect(res.data).toHaveProperty("screw_terminal_blocks")
  expect(Array.isArray(res.data.screw_terminal_blocks)).toBe(true)

  if (res.data.screw_terminal_blocks.length > 0) {
    const c = res.data.screw_terminal_blocks[0]
    expect(c).toHaveProperty("lcsc")
    expect(c).toHaveProperty("mfr")
    expect(typeof c.lcsc).toBe("number")
  }
})
