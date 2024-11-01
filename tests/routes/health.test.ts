import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /health", async () => {
  const { axios, server } = await getTestServer()

  const res = await axios.get("/health")

  expect(res.data.ok).toBe(true)
})
