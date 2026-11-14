import { expect, test } from "vitest"
import { RESISTORS_URL, createFixture } from "./d1-error-fallback-fixture"

test("only parameters a route reads create separate cached responses", async () => {
  const { self, queries } = createFixture()
  const first = await self.fetch(`${RESISTORS_URL}?resistance=1000`)
  expect(first.headers.get("x-cache")).toBe("MISS")

  const unrelated = await self.fetch(
    `${RESISTORS_URL}?utm_source=x&resistance=1000&probe=1`,
  )
  expect(unrelated.headers.get("x-cache")).toBe("HIT")
  expect(queries).toHaveLength(1)

  const otherValue = await self.fetch(`${RESISTORS_URL}?resistance=2200`)
  expect(otherValue.headers.get("x-cache")).toBe("MISS")
  expect(queries).toHaveLength(2)
})
