import type { Middleware } from "winterspec"

export const withIsApiRequest: Middleware<{}, { isApiRequest: boolean }> = async (
  req,
  ctx = { isApiRequest: false },
  next
) => {
  if (!next || typeof next !== 'function') {
    console.error('Next middleware function is undefined')
    return new Response('Internal Server Error', { status: 500 })
  }

  try {
    const url = req.url || ''
    const headers = req.headers || new Headers()

    console.log('Request in middleware:', {
      url,
      method: req.method,
      headers: headers instanceof Headers ? headers : new Headers(headers)
    })

    const hasJsonParam = url.includes('json=')
    const hasJsonContentType = headers instanceof Headers
      ? headers.get('content-type') === 'application/json'
      : false

    ctx.isApiRequest = hasJsonParam || hasJsonContentType

    return next(req, ctx)
  } catch (error) {
    console.error('Error in withIsApiRequest middleware:', error)
    ctx.isApiRequest = false
    return next(req, ctx)
  }
}
