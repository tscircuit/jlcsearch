import { jres } from "lib/utils/jres"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  jsonResponse: z.object({
    ok: z.boolean(),
  }),
} as const)(async (req, ctx) => {
  return ctx.json({ ok: true })
})
