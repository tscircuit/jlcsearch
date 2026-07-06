import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

const expectExtendedPromotionalComponents = (components: any[]) => {
  expect(components.length).toBeGreaterThan(0)

  for (const component of components) {
    expect(component).toHaveProperty("is_basic", false)
    expect(component).toHaveProperty("is_preferred", true)
    expect(component).toHaveProperty("is_extended_promotional", true)
  }
}

test("GET /api/search exposes and filters extended promotional components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/api/search?limit=25&is_extended_promotional=true",
  )

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expectExtendedPromotionalComponents(res.data.components)
})

test("GET /components/list exposes and filters extended promotional components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/components/list?json=true&is_extended_promotional=true",
  )

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  expectExtendedPromotionalComponents(res.data.components)
})
