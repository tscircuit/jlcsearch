import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /led_matrix/list.json with json param returns LED Matrix data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/led_dot_matrix_display/list.json?json=true")

  expect(res.data).toHaveProperty("led_matrices")
  expect(Array.isArray(res.data.led_matrices)).toBe(true)

  // check structure of first LED Matrix if array not empty
  if (res.data.led_matrices.length > 0) {
    const ledMatrix = res.data.led_matrices[0]
    expect(ledMatrix).toHaveProperty("lcsc")
    expect(ledMatrix).toHaveProperty("mfr")
    expect(ledMatrix).toHaveProperty("package")
    expect(ledMatrix).toHaveProperty("description")
    expect(ledMatrix).toHaveProperty("stock")
    expect(ledMatrix).toHaveProperty("price1")
    expect(ledMatrix).toHaveProperty("matrix_size")

    expect(typeof ledMatrix.lcsc).toBe("number")
    expect(typeof ledMatrix.mfr).toBe("string")
    expect(typeof ledMatrix.package).toBe("string")
    expect(typeof ledMatrix.description).toBe("string")
    expect(typeof ledMatrix.stock).toBe("number")
    expect(typeof ledMatrix.price1).toBe("number")

    if (ledMatrix.matrix_size) {
      expect(typeof ledMatrix.matrix_size).toBe("string")
    }
    if (ledMatrix.color) {
      expect(typeof ledMatrix.color).toBe("string")
    }
    if (ledMatrix.led_type) {
      expect(typeof ledMatrix.led_type).toBe("string")
    }
  }
})

test("GET /led_matrix/list.json with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get(
    "/led_dot_matrix_display/list.json?json=true&package=DIP",
  )
  expect(res.data).toHaveProperty("led_matrices")
  expect(Array.isArray(res.data.led_matrices)).toBe(true)

  // Verify all returned LED Matrices have the specified package
  for (const ledMatrix of res.data.led_matrices) {
    expect(ledMatrix.package).toBe("DIP")
  }

  // Test with color filter
  const colorRes = await axios.get(
    "/led_dot_matrix_display/list.json?json=true&color=Red",
  )
  expect(colorRes.data).toHaveProperty("led_matrices")
  expect(Array.isArray(colorRes.data.led_matrices)).toBe(true)

  // Verify all returned LED Matrices have the specified color
  for (const ledMatrix of colorRes.data.led_matrices) {
    expect(ledMatrix.color).toBe("Red")
  }
})
