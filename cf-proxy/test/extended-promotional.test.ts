import { describe, expect, it } from "vitest"
import { renderD1TablePage } from "../src/render"

describe("extended promotional component rendering", () => {
  it("renders the components filter and column label", () => {
    const html = renderD1TablePage(
      "/components/list",
      {
        components: [
          {
            lcsc: 123,
            mfr: "ABC123",
            is_extended_promotional: true,
          },
        ],
      },
      { is_extended_promotional: "true" },
      "https://example.com/components/list?is_extended_promotional=true",
    )

    expect(html).toContain('name="is_extended_promotional"')
    expect(html).toContain("Extended Promotional")
    expect(html).toContain("checked")
  })
})
