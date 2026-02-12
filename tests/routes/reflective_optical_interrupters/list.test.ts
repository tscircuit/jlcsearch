import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /reflective_optical_interrupters/list returns data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/reflective_optical_interrupters/list?json=true")
  expect(res.data).toHaveProperty("reflective_optical_interrupters")
  expect(Array.isArray(res.data.reflective_optical_interrupters)).toBe(true)
  if (res.data.reflective_optical_interrupters.length > 0) {
    const item = res.data.reflective_optical_interrupters[0]
    expect(item).toHaveProperty("lcsc")
    expect(item).toHaveProperty("mfr")
    expect(item).toHaveProperty("package")
  }
})

test("GET /reflective_optical_interrupters/list with package filter works", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/reflective_optical_interrupters/list?json=true&package=SMD-4P",
  )
  for (const item of res.data.reflective_optical_interrupters) {
    expect(item.package).toBe("SMD-4P")
  }
})
