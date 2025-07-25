import type { Middleware } from "winterspec"

export const withCacheHeaders: Middleware<{}, {}> = async (req, ctx, next) => {
  const res = await next(req, ctx)

  if (req.url.includes("tscircuit.com")) {
    // Cache for 1 week (604800 seconds) with 24 hour stale-while-revalidate
    res.headers.set(
      "Cache-Control",
      "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
    )
    res.headers.set("Vary", "*")
  }

  return res
}
