import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list with json param returns component data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
})

test("GET /components/list with is_extended_promotional=true filters correctly", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/components/list?json=true&is_extended_promotional=true",
  )
  expect(res.data).toHaveProperty("components")
  expect(res.data.components.length).toBeGreaterThan(0)
  for (const component of res.data.components) {
    expect(component.is_extended_promotional).toBe(true)
  }
})
