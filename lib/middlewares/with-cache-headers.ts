import type { Middleware } from "winterspec"

export const withCacheHeaders: Middleware<{}, {}> = async (req, ctx, next) => {
  const res = await next(req, ctx)

  if (req.url.includes("tscircuit.com")) {
    // Cache for 5 minutes, serve stale content while revalidating and on errors
    res.headers.set(
      "Cache-Control",
      "public, max-age=300, s-maxage=300, stale-while-revalidate=300, stale-if-error=86400",
    )
    res.headers.set("Vary", "*")
  }

  return res
}
