import { Middleware } from "winterspec/middleware"

export const withCtxError: Middleware<
  {},
  {
    error: (
      status: number,
      error_payload: {
        error_code: string
        message: string
      },
    ) => Response
  }
> = async (req, ctx, next) => {
  ctx.error = (status, error_payload) => {
    return new Response(JSON.stringify({ error: error_payload }), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
  return next(req, ctx)
}
