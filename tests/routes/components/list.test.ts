import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list with json param returns component data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
})

test("GET /components/list exposes is_extended_promotional field", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(Array.isArray(res.data.components)).toBe(true)
  if (res.data.components.length > 0) {
    const component = res.data.components[0]
    expect(component).toHaveProperty("is_extended_promotional")
    expect(typeof component.is_extended_promotional).toBe("boolean")
  }
})

test("GET /components/list?is_extended_promotional=true filters to extended promotional parts", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/components/list?json=true&is_extended_promotional=true",
  )
  expect(Array.isArray(res.data.components)).toBe(true)
  // Extended promotional parts are preferred but not basic.
  expect(
    res.data.components.every(
      (c: any) => c.is_extended_promotional && c.is_preferred && !c.is_basic,
    ),
  ).toBe(true)
})
