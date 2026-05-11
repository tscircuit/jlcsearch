import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list with json param returns component data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
})

test("GET /components/list preserves preferred flag in json response", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true&is_preferred=true")

  expect(res.data.components.length).toBeGreaterThan(0)
  expect(
    res.data.components.every((component: any) => component.is_preferred),
  ).toBe(true)
})

test("GET /components/list filters extended promotional parts", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/components/list?json=true&is_extended_promotional=true",
  )

  expect(res.data.components.length).toBeGreaterThan(0)
  expect(
    res.data.components.every(
      (component: any) =>
        component.is_extended_promotional &&
        component.is_preferred &&
        !component.is_basic,
    ),
  ).toBe(true)
})
