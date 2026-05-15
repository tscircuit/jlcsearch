import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list exposes and filters extended promotional components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/components/list?json=true&is_extended_promotional=true",
  )

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)
  expect(
    res.data.components.every(
      (component: any) => component.is_extended_promotional === true,
    ),
  ).toBe(true)
})

test("GET /api/search exposes and filters extended promotional components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?is_extended_promotional=true")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expect(res.data.components.length).toBeGreaterThan(0)
  expect(
    res.data.components.every(
      (component: any) => component.is_extended_promotional === true,
    ),
  ).toBe(true)
})
