import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list with json param returns component data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
})

test("GET /components/list includes is_extended_promotional field in response", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  if (res.data.components.length > 0) {
    const component = res.data.components[0]
    expect(component).toHaveProperty("is_extended_promotional")
    expect(typeof component.is_extended_promotional).toBe("boolean")
  }
})

test("GET /components/list with is_extended_promotional=true returns only extended promotional components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get(
    "/components/list?json=true&is_extended_promotional=true",
  )
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  for (const component of res.data.components) {
    expect(component.is_extended_promotional).toBe(true)
    expect(component.is_preferred).toBe(true)
    expect(component.is_basic).toBe(false)
  }
})

test("GET /components/list is_extended_promotional is consistent with is_preferred and is_basic", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")

  for (const component of res.data.components) {
    const expectedExtendedPromotional =
      component.is_preferred === true && component.is_basic === false
    expect(component.is_extended_promotional).toBe(expectedExtendedPromotional)
  }
})
