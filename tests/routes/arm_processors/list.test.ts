import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /arm_processors/list with json param returns ARM processor data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/arm_processors/list?json=true")
  expect(res.data).toHaveProperty("arm_processors")
  expect(Array.isArray(res.data.arm_processors)).toBe(true)
  if (res.data.arm_processors.length > 0) {
    const proc = res.data.arm_processors[0]
    expect(proc).toHaveProperty("lcsc")
    expect(proc.cpu_core).toMatch(/^ARM/)
  }
})
