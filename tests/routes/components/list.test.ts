import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list with json param returns component data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
})

test("GET /components/list supports C-prefixed LCSC search terms", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true&search=C1002")

  expect(res.data).toHaveProperty("components")
  expect(res.data.components).toHaveLength(1)
  expect(res.data.components[0]).toHaveProperty("lcsc", 1002)
})
