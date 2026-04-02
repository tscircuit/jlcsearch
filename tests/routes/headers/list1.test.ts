import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /headers/list with json param returns header data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/headers/list", {
    params: {
      json: true,
    },
  })

  expect(res.data).toHaveProperty("headers")
  expect(Array.isArray(res.data.headers)).toBe(true)

  // Check structure of first header if array not empty
  if (res.data.headers.length > 0) {
    const header = res.data.headers[0]
    expect(header).toHaveProperty("lcsc")
    expect(header).toHaveProperty("mfr")
    expect(header).toHaveProperty("package")
    expect(header).toHaveProperty("pitch_mm")
    expect(typeof header.lcsc).toBe("number")
  }
})
