import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list with json param returns component data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  if (res.data.components.length > 0) {
    const component = res.data.components[0]
    expect(component).toHaveProperty("description")
    expect(component).toHaveProperty("lcsc")
    expect(component).toHaveProperty("mfr")
    expect(component).toHaveProperty("package")
    expect(component).toHaveProperty("price")
    expect(component).toHaveProperty("stock")
    expect(component).toHaveProperty("is_basic")
    expect(component).toHaveProperty("is_preferred")
    expect(component).toHaveProperty("is_extended_promotional")
  }
})

test("GET /components/list exposes and filters extended promotional parts", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/components/list?json=true&is_extended_promotional=true",
  )

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  for (const component of res.data.components) {
    expect(component).toHaveProperty("is_extended_promotional", true)
    expect(component).toHaveProperty("is_preferred", true)
    expect(component).toHaveProperty("is_basic", false)
    expect(component).toHaveProperty("description")
    expect(component).toHaveProperty("lcsc")
    expect(component).toHaveProperty("mfr")
    expect(component).toHaveProperty("package")
    expect(component).toHaveProperty("price")
    expect(component).toHaveProperty("stock")
  }
})

test("GET /components/list can filter out extended promotional parts", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/components/list?json=true&is_extended_promotional=false",
  )

  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  for (const component of res.data.components) {
    expect(component).toHaveProperty("is_extended_promotional")
    expect(component.is_extended_promotional).toBe(false)
    expect(
      component.is_preferred === true && component.is_basic === false,
    ).toBe(false)
  }
})
