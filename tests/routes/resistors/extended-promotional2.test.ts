import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /resistors/list with is_extended_promotional filter does not error", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get(
    "/resistors/list?json=true&is_extended_promotional=true",
  )

  expect(res.status).toBe(200)
  expect(res.data).toHaveProperty("resistors")
  expect(Array.isArray(res.data.resistors)).toBe(true)
})
