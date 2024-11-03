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
      <a href="/categories/list">Categories</a>
      <a href="/components/list">Components</a>
      <a href="/resistors/list">Resistors</a>
      <a href="/capacitors/list">Capacitors</a>
      <a href="/leds/list">LEDs</a>
      <a href="/admin/system/create-indexes">Create Indexes</a>
    </div>,
  )
})
