import { expect, test } from "vitest"
import { createFixture } from "./d1-error-fallback-fixture"

test("an exact part lookup is answered when recording its demand fails", async () => {
  const { self, state } = createFixture()
  state.failWrites = true
  for (const path of ["/api/search?q=C1", "/components/list.json?search=C1"]) {
    const response = await self.fetch(`https://example.com${path}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ components: [{ lcsc: 1 }] })
  }
})
