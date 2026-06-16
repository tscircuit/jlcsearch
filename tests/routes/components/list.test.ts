import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list with json param returns component data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
})

test("GET /components/list response includes is_extended_promotional field", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")

  expect(res.data).toHaveProperty("components")
  expect(res.data.components.length).toBeGreaterThan(0)
  expect(res.data.components[0]).toHaveProperty("is_extended_promotional")
  expect(typeof res.data.components[0].is_extended_promotional).toBe("boolean")
})

test("GET /components/list with is_extended_promotional filter returns only promotional components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true&is_extended_promotional=true")

  expect(res.data).toHaveProperty("components")
  for (const c of res.data.components) {
    expect(c.is_extended_promotional).toBe(true)
    expect(c.is_basic).toBe(false)
  }
})
