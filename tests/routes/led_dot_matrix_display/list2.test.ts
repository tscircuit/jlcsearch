import { test, expect } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /led_dot_matrix_display/list.json with filters returns filtered data", async () => {
  const { axios } = await getTestServer()

  // Test with package filter
  const res = await axios.get(
    "/led_dot_matrix_display/list.json?json=true&package=DIP",
  )
  expect(res.data).toHaveProperty("led_dot_matrix_displays")
  expect(Array.isArray(res.data.led_dot_matrix_displays)).toBe(true)

  // Verify all returned LED Matrices have the specified package
  for (const ledMatrix of res.data.led_dot_matrix_displays) {
    expect(ledMatrix.package).toBe("DIP")
  }

  // Test with color filter
  const colorRes = await axios.get(
    "/led_dot_matrix_display/list.json?json=true&color=Red",
  )
  expect(colorRes.data).toHaveProperty("led_dot_matrix_displays")
  expect(Array.isArray(colorRes.data.led_dot_matrix_displays)).toBe(true)

  // Verify all returned LED Matrices have the specified color
  for (const ledMatrix of colorRes.data.led_dot_matrix_displays) {
    expect(ledMatrix.color).toBe("Red")
  }
})
