import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import React from "react"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  jsonResponse: z.object({
    error_code: z.string(),
    message: z.string(),
  }),
} as const)(async (req, ctx) => {
  if (ctx.isApiRequest) {
    return ctx.error(404, {
      error_code: "not_found",
      message: "Not Found",
    })
  }

  return ctx.react(
    React.createElement("div", { className: "p-8" },
      React.createElement("h1", { className: "text-2xl font-bold mb-4" }, "404 - Not Found"),
      React.createElement("p", null, "The requested page could not be found.")
    ),
    "404 Not Found"
  )
})
