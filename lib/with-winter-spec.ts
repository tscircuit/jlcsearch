import { withCors } from "lib/middlewares/with-cors"
import { withCtxError } from "lib/middlewares/with-ctx-error"
import { withDb } from "lib/middlewares/with-db"
import { withDevOnlyAuth } from "lib/middlewares/with-dev-only-auth"
import { withEnv } from "lib/middlewares/with-env"
import { withErrorResponse } from "lib/middlewares/with-error-response"
import { withLoginPageAuthToken } from "lib/middlewares/with-login-page-auth-token"
import { withNone2Auth } from "lib/middlewares/with-none2-auth"
import { withRequestLogging } from "lib/middlewares/with-request-logging"
import { withSessionAuth } from "lib/middlewares/with-session-auth"
import { createWithWinterSpec } from "winterspec"
import { withAdminAuth } from "./middlewares/with-admin-auth"
import { withCtxReact } from "./middlewares/with-ctx-react"
import { withInternalAuth } from "./middlewares/with-internal-auth"
import { withTimezone } from "./middlewares/with-timezone"
import { withInternalPublicAutomations } from "./middlewares/with-internal-public-automations"

export const withWinterSpec = createWithWinterSpec({
  authMiddleware: {
    session: withSessionAuth,
    login_page_auth_token: withLoginPageAuthToken,
    dev_only: withDevOnlyAuth,
    none2: withNone2Auth,
    admin: withAdminAuth,
    internal: withInternalAuth,
    internal_public_automations: withInternalPublicAutomations,
  },

  beforeAuthMiddleware: [
    withCors,
    withErrorResponse,
    withCtxError,
    withTimezone,
    withCtxReact,
    withEnv,
    withDb,
    withRequestLogging,
  ],

  apiName: "Registry API",
  productionServerUrl: "https://registry-api.tscircuit.com",
  addOkStatus: true,

  shouldValidateGetRequestBody: true,
  shouldValidateResponses: true,
})
