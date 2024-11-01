import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  return ctx.react(<div>Hello World</div>)
})
