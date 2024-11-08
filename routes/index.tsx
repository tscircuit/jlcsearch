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
    <div className="flex gap-4 *:text-lg *:border *:rounded *:p-2 *:border-gray-300 *:w-32 *:text-sm *:text-center">
      <a href="/categories/list">Categories</a>
      <a href="/resistors/list">Resistors</a>
      <a href="/capacitors/list">Capacitors</a>
      <a href="/headers/list">Headers</a>
      <a href="/leds/list">LEDs</a>
      <a href="/adcs/list">ADCs</a>
      <a href="/analog_multiplexers/list">Analog Muxes</a>
      <a href="/io_expanders/list">I/O Expanders</a>
    </div>,
  )
})
