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

test("GET /headers/list with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with gender filter
  const res = await axios.get("/headers/list", {
    params: {
      json: true,
      gender: "male",
    },
  })

  expect(res.data).toHaveProperty("headers")
  expect(Array.isArray(res.data.headers)).toBe(true)

  // Verify all returned headers have the specified gender
  for (const header of res.data.headers) {
    expect(header.gender).toBe("male")
  }
})

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
