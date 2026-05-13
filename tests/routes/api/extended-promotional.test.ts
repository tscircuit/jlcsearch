import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /api/search supports is_extended_promotional filter", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get(
    "/api/search?limit=10&is_extended_promotional=true",
  )

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  // All returned components should be extended promotional
  for (const component of res.data.components) {
    expect(component.is_extended_promotional).toBe(true)
  }
})

test("GET /api/search returns is_extended_promotional field", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/api/search?limit=5")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  if (res.data.components.length > 0) {
    const component = res.data.components[0]
    expect(component).toHaveProperty("is_extended_promotional")
    expect(typeof component.is_extended_promotional).toBe("boolean")
  }
})

test("GET /components/list supports is_extended_promotional filter", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get(
    "/components/list?json=true&is_extended_promotional=true",
  )

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  // All returned components should be extended promotional
  for (const component of res.data.components) {
    expect(component.is_extended_promotional).toBe(true)
  }
})
