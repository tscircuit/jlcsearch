import type { Middleware } from "winterspec"

export const withCacheHeaders: Middleware<{}, {}> = async (req, ctx, next) => {
  const res = await next(req, ctx)

  if (req.url.includes("tscircuit.com")) {
    // Save for 24 hours
    res.headers.set(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=86400",
    )
    res.headers.set("Vary", "*")
  }

  return res
}
