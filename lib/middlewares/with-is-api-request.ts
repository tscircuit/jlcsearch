import type { Middleware } from "winterspec"

export const withIsApiRequest: Middleware<{}, { isApiRequest: boolean }> = (
  req,
  ctx,
  next
) => {
  ctx.isApiRequest =
    req.url.includes("json=") ||
    req.url.includes(".json") ||
    req.headers.get("content-type") === "application/json"
  return next(req, ctx)
}
