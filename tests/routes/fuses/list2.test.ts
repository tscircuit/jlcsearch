import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /fuses/list.json with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get("/fuses/list.json?json=true&package=AXIAL")
  expect(res.data).toHaveProperty("fuses")
  expect(Array.isArray(res.data.fuses)).toBe(true)

  // Verify all returned fuses have the specified package
  for (const fuse of res.data.fuses) {
    expect(fuse.package).toBe("AXIAL")
  }

  // Test with current rating filter
  const currentRes = await axios.get(
    "/fuses/list.json?json=true&current_rating=1",
  )
  expect(currentRes.data).toHaveProperty("fuses")
  expect(Array.isArray(currentRes.data.fuses)).toBe(true)

  // Verify all returned fuses have the specified current rating
  for (const fuse of currentRes.data.fuses) {
    expect(fuse.current_rating).toBe(1)
  }

  // Test with response time filter
  const timeRes = await axios.get(
    "/fuses/list.json?json=true&response_time=Fast",
  )
  expect(timeRes.data).toHaveProperty("fuses")
  expect(Array.isArray(timeRes.data.fuses)).toBe(true)

  // Verify all returned fuses have the specified response time
  for (const fuse of timeRes.data.fuses) {
    expect(fuse.response_time).toBe("Fast")
  }
})
