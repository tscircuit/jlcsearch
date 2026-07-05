import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /categories/list with json param returns category data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/categories/list?json=true")
  expect(res.data).toHaveProperty("categories")
  expect(Array.isArray(res.data.categories)).toBe(true)
  if (res.data.categories.length > 0) {
    const category = res.data.categories[0]
    expect(category).toHaveProperty("category")
    expect(category).toHaveProperty("subcategory")
    expect(typeof category.category).toBe("string")
    expect(typeof category.subcategory).toBe("string")
  }
})
