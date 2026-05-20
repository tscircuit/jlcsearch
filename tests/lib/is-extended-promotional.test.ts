import { expect, test } from "bun:test"
import { isExtendedPromotionalComponent } from "lib/util/is-extended-promotional"

test("detects extended promotional markers in source metadata", () => {
  const extra = JSON.stringify({
    attributes: {
      "Basic/Extended": "Extended Promotional",
    },
  })

  expect(isExtendedPromotionalComponent(extra, 0, 0)).toBe(true)
})

test("detects explicit extended promotional boolean flags", () => {
  const extra = JSON.stringify({
    is_extended_promotional: true,
  })

  expect(isExtendedPromotionalComponent(extra, 0, 0)).toBe(true)
})

test("does not mark basic or preferred parts as extended promotional", () => {
  const extra = JSON.stringify({
    attributes: {
      "Basic/Extended": "Extended Promotional",
    },
  })

  expect(isExtendedPromotionalComponent(extra, 1, 0)).toBe(false)
  expect(isExtendedPromotionalComponent(extra, 0, 1)).toBe(false)
})
