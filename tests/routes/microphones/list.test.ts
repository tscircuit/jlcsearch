import { expect, test } from "bun:test"
import { getTestServer } from "../../fixtures/get-test-server"

test("GET /microphones/list.json returns microphone data", async () => {
  const { axios } = await getTestServer()
  const res = await axios.get("/microphones/list.json?json=true")

  expect(res.data).toHaveProperty("microphones")
  expect(Array.isArray(res.data.microphones)).toBe(true)

  if (res.data.microphones.length > 0) {
    const microphone = res.data.microphones[0]
    expect(microphone).toHaveProperty("lcsc")
    expect(microphone).toHaveProperty("mfr")
    expect(microphone).toHaveProperty("package")
    expect(microphone).toHaveProperty("microphone_type")
    expect(microphone).toHaveProperty("description")
    expect(microphone).toHaveProperty("stock")
    expect(microphone).toHaveProperty("price1")

    expect(typeof microphone.lcsc).toBe("number")
    expect(typeof microphone.mfr).toBe("string")
    expect(typeof microphone.package).toBe("string")
    expect(typeof microphone.microphone_type).toBe("string")
    expect(typeof microphone.description).toBe("string")
    expect(typeof microphone.stock).toBe("number")
    expect(typeof microphone.price1).toBe("number")
  }
})
