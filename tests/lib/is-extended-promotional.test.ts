import { expect, test } from "bun:test"
import { isExtendedPromotionalComponent } from "lib/util/is-extended-promotional"

test("detects promotional extended parts from source metadata strings", () => {
  expect(
    isExtendedPromotionalComponent(
      JSON.stringify({
        attributes: {
          "Basic/Extended": "Promotional Extended",
        },
      }),
      0,
      0,
    ),
  ).toBe(true)
})

test("detects promotional extended parts from source boolean flags", () => {
  expect(
    isExtendedPromotionalComponent(
      JSON.stringify({
        promotionalExtendedFlag: true,
      }),
      0,
      0,
    ),
  ).toBe(true)
})

test("does not mark basic or preferred parts as promotional extended", () => {
  const extra = JSON.stringify({
    attributes: {
      "Basic/Extended": "Promotional Extended",
    },
  })

  expect(isExtendedPromotionalComponent(extra, 1, 0)).toBe(false)
  expect(isExtendedPromotionalComponent(extra, 0, 1)).toBe(false)
})
