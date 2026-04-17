import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /components/list with json param returns component data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true")
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)
  if (res.data.components.length > 0) {
    expect(res.data.components[0]).toHaveProperty("is_extended_promotional")
    expect(typeof res.data.components[0].is_extended_promotional).toBe(
      "boolean",
    )
  }
})

test("GET /components/list supports is_extended_promotional filter", async () => {
  const { axios } = await getTestServer()
  const allRes = await axios.get("/components/list?json=true&full=true")
  const filteredRes = await axios.get(
    "/components/list?json=true&full=true&is_extended_promotional=true",
  )

  const allComponents = allRes.data.components as Array<{
    basic: number
    preferred: number
    is_extended_promotional: number
  }>
  const filteredComponents = filteredRes.data.components as Array<{
    basic: number
    preferred: number
    is_extended_promotional: number
  }>

  for (const component of allComponents) {
    const expected = component.preferred === 1 && component.basic === 0 ? 1 : 0
    expect(component.is_extended_promotional).toBe(expected)
  }

  for (const component of filteredComponents) {
    expect(component.is_extended_promotional).toBe(1)
    expect(component.preferred).toBe(1)
    expect(component.basic).toBe(0)
  }
})
