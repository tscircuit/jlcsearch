import { withCtxError } from "lib/middlewares/with-ctx-error"
import { withDb } from "lib/middlewares/with-db"
import { withErrorResponse } from "lib/middlewares/with-error-response"
import { withCtxReact } from "./middlewares/with-ctx-react"
import { createWithWinterSpec } from "winterspec"
import { withRequestLogging } from "./middlewares/with-request-logging"

export const withWinterSpec = createWithWinterSpec({
  authMiddleware: {},

  beforeAuthMiddleware: [
    withErrorResponse,
    withCtxError,
    withCtxReact,
    withDb,
    withRequestLogging,
  ],

  apiName: "tscircuit JLC Parts Engine",
  productionServerUrl: "https://partsengine.tscircuit.com",
  addOkStatus: true,

  shouldValidateGetRequestBody: true,
  shouldValidateResponses: true,
})
