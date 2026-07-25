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
    expect(html).toContain("/ble_modules/list")
    expect(html).toContain("/ble_chips/list")
    expect(html).toContain("/dimm_connectors/list")
    expect(html).toContain("/sodimm_connectors/list")
  })

  it.each([
    [
      "/dimm_connectors/list",
      "dimm_connectors",
      "DIMM Connectors",
      "90413-15011-21",
    ],
    [
      "/sodimm_connectors/list",
      "sodimm_connectors",
      "SO-DIMM Connectors",
      "ADDR0111-P005A",
    ],
  ])(
    "renders the %s page with memory connector filters",
    (pathname, responseKey, heading, mfr) => {
      expect(D1_ROUTES).toContain(pathname)
      expect(getD1Handler(pathname)).toBeTypeOf("function")

      const html = renderD1TablePage(
        pathname,
        {
          [responseKey]: [
            {
              lcsc: 2922442,
              mfr,
              ddr_standard: "DDR4",
              num_pins: 260,
              pitch_mm: 0.5,
              height_above_board_mm: 9.2,
              is_right_angle: true,
              stock: 100,
            },
          ],
        },
        {
          ddr_standard: "DDR4",
          num_pins: "260",
          pitch: "0.5",
          height_mm: "9.2",
        },
        `https://jlcsearch.tscircuit.com${pathname}?ddr_standard=DDR4&num_pins=260&pitch=0.5&height_mm=9.2`,
        {
          ddr_standard: ["DDR3", "DDR4", "DDR5"],
          num_pins: ["200", "204", "240", "260", "288"],
          pitch: ["0.5", "0.6", "0.85", "1"],
        },
      )

      expect(html).toContain(`<h2>${heading}</h2>`)
      expect(html).toContain('name="ddr_standard"')
      expect(html).toContain('name="num_pins"')
      expect(html).toContain('name="pitch"')
      expect(html).toContain('name="height_mm"')
      expect(html).toContain('name="is_right_angle"')
      expect(html).toContain(mfr)
      expect(html).toContain("9.2mm")
      expect(html).toContain(`${pathname}.json`)
    },
  )

  it.each([
    ["/ble_modules/list", "ble_modules", "BLE Modules", "VG6328A"],
    ["/ble_chips/list", "ble_chips", "BLE Chips", "NRF52832-QFAA-R"],
  ])(
    "renders the %s page with BLE filters",
    (pathname, responseKey, heading, mfr) => {
      expect(D1_ROUTES).toContain(pathname)
      expect(getD1Handler(pathname)).toBeTypeOf("function")

      const html = renderD1TablePage(
        pathname,
        {
          [responseKey]: [
            {
              lcsc: 77540,
              mfr,
              package: "QFN-48-EP(6x6)",
              bluetooth_version: "5.3",
              has_spi: true,
              stock: 100,
            },
          ],
        },
        { bluetooth_version: "5.3", has_spi: "true" },
        `https://jlcsearch.tscircuit.com${pathname}?bluetooth_version=5.3&has_spi=true`,
        { bluetooth_version: ["5.3"] },
      )

      expect(html).toContain(`<h2>${heading}</h2>`)
      expect(html).toContain('name="bluetooth_version"')
      expect(html).toContain('name="has_spi"')
      expect(html).toContain(mfr)
      expect(html).toContain(`${pathname}.json`)
    },
  )

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
            max_resolution: "32x4",
            is_basic: false,
            is_preferred: true,
            stock: 18416,
          },
        ],
      },
      {
        package: "SSOP-48-300mil",
        max_resolution: "32x4",
        is_preferred: "true",
      },
      "https://jlcsearch.tscircuit.com/lcd_drivers/list?package=SSOP-48-300mil&max_resolution=32x4&is_preferred=true",
      {
        package: ["SSOP-48-300mil"],
        max_resolution: ["32x4", "32x8"],
      },
    )

    expect(html).toContain("<h2>LCD Drivers</h2>")
    expect(html).toContain('name="package"')
    expect(html).toContain('name="max_resolution"')
    expect(html).toContain('value="32x4" selected')
    expect(html).toContain(">Max Resolution</th>")
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
            max_resolution: "864x480",
            stock: 604,
          },
        ],
      },
      {
        driver_type: "controller",
        max_resolution: "864x480",
        is_preferred: "true",
      },
      "https://jlcsearch.tscircuit.com/tft_display_drivers/list?driver_type=controller&max_resolution=864x480&is_preferred=true",
      {
        package: ["LQFP-128(14x14)"],
        max_resolution: ["864x480"],
      },
    )

    expect(html).toContain("<h2>TFT Display Drivers</h2>")
    expect(html).toContain('name="driver_type"')
    expect(html).toContain('value="controller" selected')
    expect(html).toContain('name="max_resolution"')
    expect(html).toContain('value="864x480" selected')
    expect(html).toContain(">Max Resolution</th>")
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
