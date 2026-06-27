import type { Middleware } from "winterspec/middleware"

export const allowed_headers = [
  "x-csrf-token",
  "x-requested-with",
  "accept",
  "accept-version",
  "content-length",
  "content-md5",
  "content-type",
  "date",
  "authorization",
  "user-agent",
]

export const withCors: Middleware<{}, {}> = async (req, ctx, next) => {
  const cors_headers = {
    "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": allowed_headers.join(", "),
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  }

  if (req.method === "OPTIONS") {
    return new Response("", {
      headers: cors_headers,
    })
  }
  const response = await next(req, ctx)

  if (response.headers.set) {
    for (const [header, value] of Object.entries(cors_headers)) {
      response.headers.set(header, value)
    }
  }

  return response
}
