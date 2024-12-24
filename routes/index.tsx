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
    <div className="flex flex-col gap-4">
      <form action="/components/list" method="get" className="flex justify-center">
        <input
          type="text"
          name="search"
          placeholder="Search for components..."
          className="border rounded p-2 border-gray-300 w-64 text-sm mr-2"
        />
        <button
          type="submit"
          className="border rounded p-2 border-gray-300 text-sm bg-gray-50 hover:bg-gray-100"
        >
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
      </div>
    </div>,
  )
})
