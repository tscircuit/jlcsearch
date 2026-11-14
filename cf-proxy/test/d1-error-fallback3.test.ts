import { expect, test } from "vitest"
import {
  RESISTORS_URL,
  createFixture,
  liveBody,
  seedCache,
} from "./d1-error-fallback-fixture"

test("an expired copy is replaced as soon as D1 answers again", async () => {
  const { env, self } = createFixture()
  await seedCache(env, 3 * 60)
  const response = await self.fetch(RESISTORS_URL)
  expect(response.headers.get("x-cache")).toBe("MISS")
  expect(await response.json()).toEqual(liveBody)
  expect((await self.fetch(RESISTORS_URL)).headers.get("x-cache")).toBe("HIT")
})
