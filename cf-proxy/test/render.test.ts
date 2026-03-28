import { describe, expect, it } from "vitest"
import { renderD1TablePage, renderHomePage } from "../src/render"

describe("render helpers", () => {
  it("renders a home page with D1-backed route links", () => {
    const html = renderHomePage()

    expect(html).toContain("JLCPCB In-Stock Parts Engine (Unofficial)")
    expect(html).toContain("/led_with_ic/list")
    expect(html).toContain("/resistors/list")
  })

  it("renders an HTML table page for a supported D1 route", () => {
    const html = renderD1TablePage(
      "/led_with_ic/list",
      {
        leds_with_ic: [
          {
            lcsc: 123,
            mfr: "WS2812B",
            package: "SMD5050-4P",
            protocol: "WS2812B",
          },
        ],
      },
      { protocol: "WS2812B" },
      "https://jlcsearch-proxy-staging.seve.workers.dev/led_with_ic/list?protocol=WS2812B",
    )

    expect(html).toContain("<h2>LEDs with Built-in IC</h2>")
    expect(html).toContain('name="protocol"')
    expect(html).toContain('value="WS2812B"')
    expect(html).toContain(
      '<table class="border border-gray-300 text-xs border-collapse p-1">',
    )
    expect(html).toContain("SMD5050-4P")
    expect(html).toContain("/led_with_ic/list.json?protocol=WS2812B")
  })
})
