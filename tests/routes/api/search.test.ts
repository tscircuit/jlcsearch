import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list with search query 'C1234' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=1&q=C1234")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  expect(res.data.components).toMatchSnapshot()
})

test("GET /components/list with search query '555 Timer' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=1&q=555%20Timer")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  expect(res.data.components).toMatchSnapshot()
})

test("GET /components/list with search query 'red led' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/api/search?limit=1&q=red led")

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  expect(res.data.components).toMatchSnapshot()
})
