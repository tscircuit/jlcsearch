import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /risc_v_processors/list with json param returns RISC-V processor data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/risc_v_processors/list?json=true")
  expect(res.data).toHaveProperty("risc_v_processors")
  expect(Array.isArray(res.data.risc_v_processors)).toBe(true)
  if (res.data.risc_v_processors.length > 0) {
    const proc = res.data.risc_v_processors[0]
    expect(proc).toHaveProperty("lcsc")
    expect(proc).toHaveProperty("cpu_core", "RISC-V")
  }
})
