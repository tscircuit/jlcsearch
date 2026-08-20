import { describe, expect, test } from "bun:test"
import { deriveIsExtendedPromotional } from "lib/db/derive-extended-promotional"

describe("deriveIsExtendedPromotional", () => {
  test("uses the JLCPCB extended promotional library type when present", () => {
    expect(
      deriveIsExtendedPromotional({
        basic: 1,
        preferred: 0,
        extra: JSON.stringify({ componentLibraryType: "expand" }),
      }),
    ).toBe(true)

    expect(
      deriveIsExtendedPromotional({
        basic: 0,
        preferred: 0,
        extra: { componentLibraryType: "expandPrefer" },
      }),
    ).toBe(true)
  })

  test("falls back to preferred non-basic source flags", () => {
    expect(
      deriveIsExtendedPromotional({
        basic: 0,
        preferred: 1,
        extra: JSON.stringify({ componentLibraryType: "preferred" }),
      }),
    ).toBe(true)

    expect(
      deriveIsExtendedPromotional({
        basic: 1,
        preferred: 1,
        extra: JSON.stringify({ componentLibraryType: "base" }),
      }),
    ).toBe(false)

    expect(
      deriveIsExtendedPromotional({
        basic: 0,
        preferred: 1,
        extra: "not-json",
      }),
    ).toBe(true)
  })
})
