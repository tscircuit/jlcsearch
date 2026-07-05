import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /fuses/list.json with json param returns fuse data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/fuses/list.json?json=true")

  expect(res.data).toHaveProperty("fuses")
  expect(Array.isArray(res.data.fuses)).toBe(true)

  // check structure of first fuse if array not empty
  if (res.data.fuses.length > 0) {
    const fuse = res.data.fuses[0]
    expect(fuse).toHaveProperty("lcsc")
    expect(fuse).toHaveProperty("mfr")
    expect(fuse).toHaveProperty("package")
    expect(fuse).toHaveProperty("description")
    expect(fuse).toHaveProperty("stock")
    expect(fuse).toHaveProperty("price1")
    expect(fuse).toHaveProperty("current_rating")
    expect(fuse).toHaveProperty("voltage_rating")
    expect(fuse).toHaveProperty("response_time")
    expect(fuse).toHaveProperty("is_surface_mount")
    expect(fuse).toHaveProperty("is_glass_encased")
    expect(fuse).toHaveProperty("is_resettable")

    expect(typeof fuse.lcsc).toBe("number")
    expect(typeof fuse.mfr).toBe("string")
    expect(typeof fuse.package).toBe("string")
    expect(typeof fuse.description).toBe("string")
    expect(typeof fuse.stock).toBe("number")
    expect(typeof fuse.price1).toBe("number")
    expect(typeof fuse.current_rating).toBe("number")
    expect(typeof fuse.voltage_rating).toBe("number")
    expect(typeof fuse.response_time).toBe("string")
    expect(typeof fuse.is_surface_mount).toBe("boolean")
    expect(typeof fuse.is_glass_encased).toBe("boolean")
    expect(typeof fuse.is_resettable).toBe("boolean")
  }
})
