import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list with json param returns component data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  if (res.data.components.length > 0) {
    expect(res.data.components[0]).toHaveProperty("is_extended_promotional")
  }
})

test("GET /components/list filters extended promotional components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/components/list?json=true&is_extended_promotional=true",
  )
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(
    res.data.components.every(
      (component: any) =>
        component.is_extended_promotional &&
        component.is_preferred &&
        !component.is_basic,
    ),
  ).toBe(true)
})
