import { expect, test } from "bun:test"
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
  expect(res.data.components.length).toBeGreaterThan(0)

  const component = res.data.components[0]
  expect(component).toHaveProperty("is_extended_promotional")
  expect(typeof component.is_extended_promotional).toBe("boolean")
})

test("GET /components/list with is_extended_promotional=true returns only extended promotional components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/components/list?json=true&is_extended_promotional=true",
  )

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  for (const component of res.data.components) {
    expect(component.is_preferred).toBe(true)
    expect(component.is_basic).toBe(false)
    expect(component.is_extended_promotional).toBe(true)
  }
})
