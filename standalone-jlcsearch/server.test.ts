import { expect, test } from "bun:test"
import { createStandaloneJlcsearchHandler } from "./server"

test("serves the JLC search API from a compressed snapshot", async () => {
  const handler = await createStandaloneJlcsearchHandler()
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: handler })
  try {
    const url = `${server.url.origin}/api/search`
    const exact = await fetch(`${url}?q=C2040&limit=10`)
    expect(exact.status).toBe(200)
    expect((await exact.json()).components[0].mfr).toBe("RP2040")
    const partial = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "q=rp204&limit=10",
    })
    expect((await partial.json()).components[0].lcsc).toBe(2040)
    expect(
      (await (await fetch(`${url}?q=not-a-real-part`)).json()).components,
    ).toEqual([])
    expect((await fetch(`${url}?limit=-1`)).status).toBe(400)
    expect((await fetch(`${url}?q=C2040`, { method: "HEAD" })).status).toBe(200)
    expect((await fetch(`${server.url.origin}/missing`)).status).toBe(404)
  } finally {
    server.stop(true)
  }
})
