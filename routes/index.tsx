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

  return ctx.react(
    <div>
      <form action="/components/list" method="GET" className="mb-4">
        <input
          type="text"
          name="search"
          placeholder="Search by description, mfr, or LCSC"
          className="border p-1 mr-2"
        />
        <button type="submit" className="border px-3 py-1">
          Search
        </button>
      </form>
      <div className="flex flex-wrap gap-4 *:text-lg *:border *:rounded *:p-2 *:border-gray-300 *:w-32 *:text-sm *:text-center">
        <a href="/categories/list">Categories</a>
        <a href="/resistors/list">Resistors</a>
        <a href="/capacitors/list">Capacitors</a>
        <a href="/headers/list">Headers</a>
        <a href="/leds/list">LEDs</a>
        <a href="/adcs/list">ADCs</a>
        <a href="/analog_multiplexers/list">Analog Muxes</a>
        <a href="/io_expanders/list">I/O Expanders</a>
        <a href="/diodes/list">Diodes</a>
        <a href="/dacs/list">DACs</a>
        <a href="/wifi_modules/list">WiFi Modules</a>
        <a href="/microcontrollers/list">Microcontrollers</a>
        <a href="/voltage_regulators/list">Voltage Regulators</a>
        <a href="/led_drivers/list">LED Drivers</a>
        <a href="/mosfets/list">Mosfets</a>
      </div>
    </div>,
  )
})
