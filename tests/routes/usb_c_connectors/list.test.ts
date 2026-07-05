import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /usb_c_connectors/list with json param returns data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/usb_c_connectors/list?json=true")

  expect(res.data).toHaveProperty("usb_c_connectors")
  expect(Array.isArray(res.data.usb_c_connectors)).toBe(true)

  if (res.data.usb_c_connectors.length > 0) {
    const c = res.data.usb_c_connectors[0]
    expect(c).toHaveProperty("lcsc")
    expect(c).toHaveProperty("mfr")
    expect(c).toHaveProperty("package")
    expect(typeof c.lcsc).toBe("number")
  }
})

test("GET /usb_c_connectors/list with gender filter returns filtered data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/usb_c_connectors/list?json=true&gender=Female")

  expect(res.data).toHaveProperty("usb_c_connectors")
  expect(Array.isArray(res.data.usb_c_connectors)).toBe(true)

  for (const c of res.data.usb_c_connectors) {
    if (c.gender) {
      expect(c.gender).toBe("Female")
    }
  }
})
