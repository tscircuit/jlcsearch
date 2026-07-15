import { describe, expect, it } from "vitest"
import { D1_ROUTES, getD1Handler } from "../src/d1-routes"
import { renderD1TablePage, renderHomePage } from "../src/render"

describe("render helpers", () => {
  it("renders a home page with D1-backed route links", () => {
    const html = renderHomePage()

    expect(html).toContain("JLCPCB In-Stock Parts Engine (Unofficial)")
    expect(html).toContain("/led_with_ic/list")
    expect(html).toContain("/resistors/list")
    expect(html).toContain("/spring_clamp_terminal_blocks/list")
  })

  it("renders the spring clamp route with pitch and pin filters", () => {
    expect(D1_ROUTES).toContain("/spring_clamp_terminal_blocks/list")
    expect(getD1Handler("/spring_clamp_terminal_blocks/list")).toBeTypeOf(
      "function",
    )

    const html = renderD1TablePage(
      "/spring_clamp_terminal_blocks/list",
      {
        spring_clamp_terminal_blocks: [
          {
            lcsc: 35616,
            mfr: "WJ142R-5.08-2P",
            pitch_mm: 5.08,
            num_pins: 2,
          },
        ],
      },
      { pitch: "5.08", pins: "2" },
      "https://jlcsearch.tscircuit.com/spring_clamp_terminal_blocks/list?pitch=5.08&pins=2",
      { pitch: ["5.08"], pins: ["2"] },
    )

    expect(html).toContain("<h2>Spring Clamp Terminal Blocks</h2>")
    expect(html).toContain('name="pitch"')
    expect(html).toContain('name="pins"')
    expect(html).toContain("WJ142R-5.08-2P")
    expect(html).toContain("/spring_clamp_terminal_blocks/list.json")
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

  it("renders attributes cells inside details with a truncated summary", () => {
    const html = renderD1TablePage(
      "/ldos/list",
      {
        ldos: [
          {
            lcsc: 347222,
            mfr: "AMS1117-3.3",
            attributes:
              '{"Power Supply Rejection Ratio (PSRR)":"60dB@(120Hz)","Feature":"Overcurrent Protection(OCP)"}',
          },
        ],
      },
      {},
      "https://example.com/ldos/list",
    )

    expect(html).toContain("<details><summary>{&quot;Power Su...</summary>")
    expect(html).toContain(
      "Feature&quot;:&quot;Overcurrent Protection(OCP)&quot;",
    )
  })

  it("renders the extended promotional filter and column for components", () => {
    const html = renderD1TablePage(
      "/components/list",
      {
        components: [
          {
            lcsc: 123,
            mfr: "PROMO-PART",
            is_extended_promotional: true,
          },
        ],
      },
      { is_extended_promotional: "true" },
      "https://example.com/components/list?is_extended_promotional=true",
    )

    expect(html).toContain('name="is_extended_promotional"')
    expect(html).toContain('value="true" checked')
    expect(html).toContain("Extended Promotional")
    expect(html).toContain("PROMO-PART")
  })
})
