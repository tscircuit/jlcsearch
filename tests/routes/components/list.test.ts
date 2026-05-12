import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list with json param returns component data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
})

test("GET /components/list returns is_extended_promotional field", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  if (res.data.components.length > 0) {
    expect(res.data.components[0]).toHaveProperty("is_extended_promotional")
    expect(typeof res.data.components[0].is_extended_promotional).toBe("boolean")
  }
})

test("GET /components/list?is_extended_promotional=true filters extended promotional parts", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true&is_extended_promotional=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  for (const component of res.data.components) {
    expect(component.is_extended_promotional).toBe(true)
    expect(component.is_preferred).toBe(true)
    expect(component.is_basic).toBe(false)
  }
})
