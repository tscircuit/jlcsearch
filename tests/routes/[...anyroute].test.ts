import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /not-found", async () => {
  const { axios } = await getTestServer()

  try {
    await axios.get("/not-found/list?json=true")
  } catch (error: any) {
    expect(error.status).toBe(404)
    expect(error.headers.get("content-type")).toBe("application/json")
    expect(error.data.error.error_code).toBe("not_found")
    expect(error.data.error.message).toBe("Not Found")
  }
})
