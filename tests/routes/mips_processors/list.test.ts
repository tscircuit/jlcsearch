import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /mips_processors/list with json param returns MIPS processor data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/mips_processors/list?json=true")
  expect(res.data).toHaveProperty("mips_processors")
  expect(Array.isArray(res.data.mips_processors)).toBe(true)
  if (res.data.mips_processors.length > 0) {
    const proc = res.data.mips_processors[0]
    expect(proc).toHaveProperty("lcsc")
    expect(proc).toHaveProperty("cpu_core", "MIPS")
  }
})
