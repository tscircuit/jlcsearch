import { expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

test("GET /fpgas/list with json param returns fpga data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/fpgas/list?json=true")

  expect(res.data).toHaveProperty("fpgas")
  expect(Array.isArray(res.data.fpgas)).toBe(true)

  if (res.data.fpgas.length > 0) {
    const fpga = res.data.fpgas[0]
    expect(fpga).toHaveProperty("lcsc")
    expect(fpga).toHaveProperty("mfr")
    expect(fpga).toHaveProperty("package")
    expect(fpga).toHaveProperty("logic_elements")
  }
})
