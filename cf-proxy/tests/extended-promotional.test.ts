import { describe, expect, it, vi } from "vitest"

vi.mock("../src/search", () => ({
  searchIndex: vi.fn(async () => [
    {
      lcsc: 123,
      mfr: "ACME",
      package: "SOT-23",
      basic: 0,
      preferred: 1,
      is_extended_promotional: 1,
      description: "promo part",
      stock: 42,
      price: '[{"price":0.01}]',
      category: "ICs",
      subcategory: "Linear",
      extra: null,
    },
  ]),
}))

import { queryComponentCatalog } from "../src/components"
import { renderD1TablePage } from "../src/render"
import { searchIndex } from "../src/search"

describe("extended promotional support", () => {
  it("passes the extended promotional filter through to the search layer", async () => {
    const rows = await queryComponentCatalog({} as never, {
      search: "promo",
      is_extended_promotional: "true",
    })

    expect(searchIndex).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        q: "promo",
        is_extended_promotional: "true",
      }),
    )
    expect(rows[0]?.is_extended_promotional).toBe(1)
    expect(rows[0]?.extra).toBeNull()
  })

  it("renders the extended promotional filter and column", () => {
    const html = renderD1TablePage(
      "/components/list",
      {
        components: [
          {
            lcsc: 123,
            mfr: "ACME",
            package: "SOT-23",
            description: "promo part",
            stock: 42,
            price: '[{"price":0.01}]',
            category: "ICs",
            subcategory: "Linear",
            is_basic: false,
            is_preferred: true,
            is_extended_promotional: true,
          },
        ],
      },
      { is_extended_promotional: "true" },
    )

    expect(html).toContain('name="is_extended_promotional"')
    expect(html).toContain("Extended Promotional")
    expect(html).toContain("checked")
  })
})
