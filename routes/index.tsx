import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["HEAD", "GET", "POST"],
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  if (req.method === "HEAD") {
    return new Response(null, { status: 200 })
  }

  const protocol = req.headers.get("x-forwarded-proto") || "http"
  const host = req.headers.get("host")
  const baseUrl = protocol + "://" + host

  return ctx.react(
    <div>
      <div className="flex flex-wrap gap-4 *:text-lg *:border *:rounded *:p-2 *:border-gray-300 *:w-32 *:text-sm *:text-center">
        <a href={baseUrl + "/categories/list"}>Categories</a>
        <a href={baseUrl + "/resistors/list"}>Resistors</a>
        <a href={baseUrl + "/capacitors/list"}>Capacitors</a>
        <a href={baseUrl + "/headers/list"}>Headers</a>
        <a href={baseUrl + "/leds/list"}>LEDs</a>
        <a href={baseUrl + "/adcs/list"}>ADCs</a>
        <a href={baseUrl + "/analog_multiplexers/list"}>Analog Muxes</a>
        <a href={baseUrl + "/io_expanders/list"}>I/O Expanders</a>
        <a href={baseUrl + "/diodes/list"}>Diodes</a>
        <a href={baseUrl + "/dacs/list"}>DACs</a>
        <a href={baseUrl + "/wifi_modules/list"}>WiFi Modules</a>
        <a href={baseUrl + "/microcontrollers/list"}>Microcontrollers</a>
        <a href={baseUrl + "/voltage_regulators/list"}>Voltage Regulators</a>
        <a href={baseUrl + "/led_drivers/list"}>LED Drivers</a>
        <a href={baseUrl + "/mosfets/list"}>Mosfets</a>
        <a href={baseUrl + "/led_with_ic/list"}>LED with ICs</a>
        <a href={baseUrl + "/led_dot_matrix_display/list"}>
          LED Dot Matrix Displays Modules
        </a>
        <a href={baseUrl + "/oled_display/list"}> OLED Displays Modules</a>
        <a href={baseUrl + "/led_segment_display/list"}>
          LED Segment Display Modules
        </a>
        <a href={baseUrl + "/lcd_display/list"}>LCD Display Modules</a>
      </div>
    </div>,
  )
})
