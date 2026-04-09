import type { Middleware } from "winterspec"

const TWO_WEEKS_SECONDS = 14 * 24 * 60 * 60
const ONE_MONTH_SECONDS = 30 * 24 * 60 * 60
const STALE_WHILE_REVALIDATE_SECONDS =
  ONE_MONTH_SECONDS - TWO_WEEKS_SECONDS

export const withCacheHeaders: Middleware<{}, {}> = async (req, ctx, next) => {
  const res = await next(req, ctx)

  if (req.url.includes("tscircuit.com")) {
    res.headers.set(
      "Cache-Control",
      [
        "public",
        `max-age=${TWO_WEEKS_SECONDS}`,
        `s-maxage=${TWO_WEEKS_SECONDS}`,
        `stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
        `stale-if-error=${STALE_WHILE_REVALIDATE_SECONDS}`,
      ].join(", "),
    )
    res.headers.set("Vary", "Accept, Origin")
  }

  return res
}
