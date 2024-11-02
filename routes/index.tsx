import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  return ctx.react(
    <div>
      <a href="/admin/categories/list">Categories</a>
      <a href="/admin/components/list">Components</a>
    </div>,
  )
})
