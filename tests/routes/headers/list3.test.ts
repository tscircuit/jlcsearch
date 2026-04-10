import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /headers/list allows empty gender parameter", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/headers/list", {
    params: {
      json: true,
      gender: "",
    },
  })

  expect(res.data).toHaveProperty("headers")
  expect(Array.isArray(res.data.headers)).toBe(true)
})
