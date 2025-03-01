import { test, expect } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

const extractSnapshotData = (components: any[]) => 
  components.map(({ lcsc, mfr, package: pkg, description }) => ({ lcsc, mfr, package: pkg, description }))

test("GET /components/list with search query 'C1234' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true&q=C1234")
  
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  expect(extractSnapshotData(res.data.components)).toMatchSnapshot()
})

test("GET /components/list with search query '555 Timer' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true&q=555%20Timer")
  
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  expect(extractSnapshotData(res.data.components)).toMatchSnapshot()
})

test("GET /components/list with search query 'led red' returns expected components", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/components/list?json=true&q=led%20red")
  
  expect(res.data).toHaveProperty("components")
  expect(Array.isArray(res.data.components)).toBe(true)

  expect(extractSnapshotData(res.data.components)).toMatchSnapshot()
})
