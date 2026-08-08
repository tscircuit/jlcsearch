import { describe, expect, it } from "vitest"
import { getPcbaType } from "../src/components"

describe("getPcbaType", () => {
  it("marks basic parts as available for Economic and Standard assembly", () => {
    expect(getPcbaType(true)).toBe("Economic and Standard")
  })

  it("marks non-basic parts as Standard assembly only", () => {
    expect(getPcbaType(false)).toBe("Standard")
  })
})
