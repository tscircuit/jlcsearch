import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  jsonResponse: z.object({
    error_code: z.string(),
    message: z.string(),
  }),
} as const)(async (req, ctx) => {
  return ctx.error(404, {
    error_code: "not_found",
    message: "Not Found",
  })
})
