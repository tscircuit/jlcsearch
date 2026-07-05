import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /battery_holders/list with json param returns data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get("/battery_holders/list?json=true")

  expect(res.data).toHaveProperty("battery_holders")
  expect(Array.isArray(res.data.battery_holders)).toBe(true)

  if (res.data.battery_holders.length > 0) {
    const holder = res.data.battery_holders[0]
    expect(holder).toHaveProperty("lcsc")
    expect(holder).toHaveProperty("mfr")
    expect(holder).toHaveProperty("package")
    expect(typeof holder.lcsc).toBe("number")
  }
})
