import { withCtxError } from "lib/middlewares/with-ctx-error"
import { withDb } from "lib/middlewares/with-db"
import { withErrorResponse } from "lib/middlewares/with-error-response"
import { withCtxReact } from "./middlewares/with-ctx-react"
import { createWithWinterSpec } from "winterspec"
import { withRequestLogging } from "./middlewares/with-request-logging"
import { withCacheHeaders } from "./middlewares/with-cache-headers"
import { withIsApiRequest } from "./middlewares/with-is-api-request"

export const withWinterSpec = createWithWinterSpec({
  authMiddleware: {},

  beforeAuthMiddleware: [
    withErrorResponse,
    withCtxError,
    withCtxReact,
    withDb,
    withRequestLogging,
    withCacheHeaders,
    withIsApiRequest,
  ],

  apiName: "tscircuit JLC Search",
  productionServerUrl: "https://jlcsearch.tscircuit.com",
  addOkStatus: true,

  shouldValidateGetRequestBody: true,
  shouldValidateResponses: true,
})
