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
    expect(html).toContain("/hdmi_ports/list")
    expect(html).toContain("/photo_diodes/list")
  })

  it("renders the Photo Diodes page and JSON API link", () => {
    const pathname = "/photo_diodes/list"

    expect(D1_ROUTES).toContain(pathname)
    expect(getD1Handler(pathname)).toBeTypeOf("function")

    const html = renderD1TablePage(
      pathname,
      {
        photo_diodes: [
          {
            lcsc: 161211,
            mfr: "PD15-22B/TR8",
            package: "SMD-4P,2.7x3.2mm",
            peak_wavelength_nm: 940,
            spectral_range_min_nm: 730,
            spectral_range_max_nm: 1100,
            reverse_voltage: 32,
            dark_current_a: 10e-9,
            reception_angle_deg: 60,
            stock: 47803,
          },
        ],
      },
      {
        package: "SMD-4P,2.7x3.2mm",
        wavelength: "850",
        peak_distance_max: "100",
        excluded_peak_bands: "900-1100",
        reverse_voltage_min: "20",
        dark_current_max: "0.00000001",
      },
      "https://jlcsearch.tscircuit.com/photo_diodes/list?package=SMD-4P%2C2.7x3.2mm&wavelength=850",
      {
        package: ["SMD-4P,2.7x3.2mm", "Plugin"],
      },
    )

    expect(html).toContain("<h2>Photo Diodes</h2>")
    expect(html).toContain('name="package"')
    expect(html).toContain('name="wavelength"')
    expect(html).not.toContain('name="wavelength_min"')
    expect(html).toContain("Target Wavelength (nm)")
    expect(html).toContain('name="peak_distance_max"')
    expect(html).toContain("Max Distance from Peak (nm)")
    expect(html).toContain('name="excluded_peak_bands"')
    expect(html).toContain("Excluded Peak Bands (nm)")
    expect(html).toContain("700-1100, 532")
    expect(html).toContain("optical filtering may be needed")
    expect(html).toContain('name="reverse_voltage_min"')
    expect(html).toContain('name="dark_current_max"')
    expect(html).toContain('name="is_basic"')
    expect(html).toContain('name="is_preferred"')
    expect(html).toContain("PD15-22B/TR8")
    expect(html).toContain("940nm")
    expect(html).toContain("10nA")
    expect(html).toContain("60°")
    expect(html).toContain("/photo_diodes/list.json")

    const legacyHtml = renderD1TablePage(
      pathname,
      { photo_diodes: [] },
      { wavelength_min: "300" },
      "https://jlcsearch.tscircuit.com/photo_diodes/list?wavelength_min=300",
    )
    expect(legacyHtml).toContain('name="wavelength" value="300"')
  })

  it("renders the HDMI ports page and JSON API link", () => {
    const pathname = "/hdmi_ports/list"

    expect(D1_ROUTES).toContain(pathname)
    expect(getD1Handler(pathname)).toBeTypeOf("function")

    const html = renderD1TablePage(
      pathname,
      {
        hdmi_ports: [
          {
            lcsc: 720616,
            mfr: "HDMI-001S",
            package: "SMD",
            mounting_style: "Surface Mount",
            orientation: "Horizontal",
            gender: "Female",
            number_of_pins: 19,
            current_rating_a: 0.5,
            stock: 16120,
          },
        ],
      },
      {
        package: "SMD",
        mounting_style: "Surface Mount",
        gender: "Female",
        number_of_pins: "19",
      },
      "https://jlcsearch.tscircuit.com/hdmi_ports/list?package=SMD&mounting_style=Surface+Mount&gender=Female&number_of_pins=19",
      {
        package: ["SMD", "Push-Pull"],
        mounting_style: ["Surface Mount", "Through Hole"],
        gender: ["Female", "Male"],
        number_of_pins: ["19"],
      },
    )

    expect(html).toContain("<h2>HDMI Ports</h2>")
    expect(html).toContain('name="package"')
    expect(html).toContain('name="mounting_style"')
    expect(html).toContain('name="orientation"')
    expect(html).toContain('name="gender"')
    expect(html).toContain('name="number_of_pins"')
    expect(html).toContain('name="is_basic"')
    expect(html).toContain('name="is_preferred"')
    expect(html).toContain("HDMI-001S")
    expect(html).toContain("500mA")
    expect(html).toContain("/hdmi_ports/list.json")
  })

  it("renders the component catalog page with extended promotional filter", () => {
    const html = renderD1TablePage(
      "/components/list",
      {
        components: [
          {
            lcsc: 23456,
            mfr: "HDMI-EXT",
            package: "SMD",
            description: "Extended promotional HDMI part",
            is_extended_promotional: true,
          },
        ],
      },
      {
        search: "HDMI",
        is_extended_promotional: "true",
      },
      "https://jlcsearch.tscircuit.com/components/list?search=HDMI&is_extended_promotional=true",
    )

    expect(html).toContain("<h2>Components</h2>")
    expect(html).toContain('name="is_basic"')
    expect(html).toContain('name="is_preferred"')
    expect(html).toContain(
      'name="is_extended_promotional" value="true" checked',
    )
    expect(html).toContain(">Extended Promotional</th>")
    expect(html).toContain("HDMI-EXT")
  })

  it("renders ARM processor memory sizes with byte units", () => {
    const html = renderD1TablePage(
      "/arm_processors/list",
      {
        arm_processors: [
          {
            lcsc: 8734,
            mfr: "STM32F103C8T6",
            package: "LQFP-48(7x7)",
            cpu_core: "ARM-M3",
            cpu_speed_hz: 72_000_000,
            flash_size_bytes: 64 * 1024,
            ram_size_bytes: 20 * 1024,
            eeprom_size_bytes: 4,
            gpio_count: 37,
            stock: 214596,
          },
        ],
      },
      {},
      "https://jlcsearch.tscircuit.com/arm_processors/list",
    )

    expect(html).toContain("64KB")
    expect(html).toContain("20KB")
    expect(html).toContain("4B")
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
