import { describe, expect, it } from "vitest"
import { D1_ROUTES, getD1Handler } from "../src/d1-routes"
import { renderD1TablePage, renderHomePage } from "../src/render"

describe("render helpers", () => {
  it("renders a home page with D1-backed route links", () => {
    const html = renderHomePage()

    expect(html).toContain("JLCPCB In-Stock Parts Engine (Unofficial)")
    expect(html).toContain("/led_with_ic/list")
    expect(html).toContain("/lcd_drivers/list")
    expect(html).toContain("/tft_display_drivers/list")
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

  it("renders the LCD driver catalog route with package and assembly filters", () => {
    expect(D1_ROUTES).toContain("/lcd_drivers/list")
    expect(getD1Handler("/lcd_drivers/list")).toBeTypeOf("function")

    const html = renderD1TablePage(
      "/lcd_drivers/list",
      {
        lcd_drivers: [
          {
            lcsc: 7873,
            mfr: "HT1621B",
            package: "SSOP-48-300mil",
            is_basic: false,
            is_preferred: true,
            stock: 18416,
          },
        ],
      },
      { package: "SSOP-48-300mil", is_preferred: "true" },
      "https://jlcsearch.tscircuit.com/lcd_drivers/list?package=SSOP-48-300mil&is_preferred=true",
      { package: ["SSOP-48-300mil"] },
    )

    expect(html).toContain("<h2>LCD Drivers</h2>")
    expect(html).toContain('name="package"')
    expect(html).toContain('name="is_basic"')
    expect(html).toContain('name="is_preferred" value="true" checked')
    expect(html).toContain("HT1621B")
    expect(html).toContain("/lcd_drivers/list.json")
  })

  it("renders the TFT display driver route with driver type filters", () => {
    expect(D1_ROUTES).toContain("/tft_display_drivers/list")
    expect(getD1Handler("/tft_display_drivers/list")).toBeTypeOf("function")

    const html = renderD1TablePage(
      "/tft_display_drivers/list",
      {
        tft_display_drivers: [
          {
            lcsc: 15216,
            mfr: "SSD1963QL9",
            package: "LQFP-128(14x14)",
            driver_type: "Display Controller",
            stock: 604,
          },
        ],
      },
      { driver_type: "controller", is_preferred: "true" },
      "https://jlcsearch.tscircuit.com/tft_display_drivers/list?driver_type=controller&is_preferred=true",
      { package: ["LQFP-128(14x14)"] },
    )

    expect(html).toContain("<h2>TFT Display Drivers</h2>")
    expect(html).toContain('name="driver_type"')
    expect(html).toContain('value="controller" selected')
    expect(html).toContain("Display Controller")
    expect(html).toContain("SSD1963QL9")
    expect(html).toContain("/tft_display_drivers/list.json")
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
})
