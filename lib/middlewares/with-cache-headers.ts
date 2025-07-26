import type { Middleware } from "winterspec"

export const withCacheHeaders: Middleware<{}, {}> = async (req, ctx, next) => {
  const res = await next(req, ctx)

  if (req.url.includes("tscircuit.com")) {
    const path = new URL(req.url).pathname

    if (path === "/") {
      // Cache the homepage for 5 minutes, serve stale content while revalidating or on errors
      res.headers.set(
        "Cache-Control",
        "public, max-age=300, s-maxage=300, stale-while-revalidate=300, stale-if-error=86400",
      )
    } else {
      // Cache other pages for 1 week with 24h stale-while-revalidate
      res.headers.set(
        "Cache-Control",
        "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
      )
    }

    res.headers.set("Vary", "*")
  }

  return res
}
