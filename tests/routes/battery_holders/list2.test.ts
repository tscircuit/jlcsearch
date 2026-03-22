import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /battery_holders/list with battery type filter returns filtered data", async () => {
  const { axios } = await getTestServer()

  const res = await axios.get(
    "/battery_holders/list?json=true&battery_type=CR2032",
  )

  expect(res.data).toHaveProperty("battery_holders")
  expect(Array.isArray(res.data.battery_holders)).toBe(true)

  for (const holder of res.data.battery_holders) {
    if (holder.battery_type) {
      expect(holder.battery_type).toBe("CR2032")
    }
  }
})
