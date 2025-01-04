import { renderToString } from "react-dom/server"
import type { Middleware } from "winterspec"
import type { ReactNode } from "react"

export const withCtxReact: Middleware<
  {},
  { react: (component: ReactNode) => Response }
> = async (req, ctx, next) => {
  ctx.react = (component: ReactNode) => {
    const pathComponents = new URL(req.url).pathname.split("/").filter(Boolean)
    const timezone = req.headers.get("X-Timezone") || "UTC"
    return new Response(
      renderToString(
        <html lang="en">
          <meta charSet="utf-8" />
          <script src="https://cdn.tailwindcss.com" />
          <style
            type="text/tailwindcss"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
            dangerouslySetInnerHTML={{
              __html: `
a {
   @apply underline text-blue-600 hover:text-blue-800 visited:text-purple-600 m-1
}
h2 {
  @apply text-xl font-bold my-2
}
input, select {
  @apply border border-gray-300 rounded p-1 ml-0.5
}
form {
  @apply inline-flex flex-col gap-2 border border-gray-300 rounded p-2 m-2 text-xs
}
button {
  @apply bg-blue-500 hover:bg-blue-700 text-white font-bold py-0.5 px-3 rounded
}
.wrapper {
  @apply min-h-screen flex flex-col
}
.content {
  @apply flex-grow
}
.footer {
  @apply text-center py-2 text-xs text-gray-600 border-t border-gray-300 mt-4
}
`,
            }}
          />
          <script
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Analytics script needs to execute
            dangerouslySetInnerHTML={{
              __html: `
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('phc_htd8AQjSfVEsFCLQMAiUooG4Q0DKBCjqYuQglc9V3Wo', {
        api_host:'https://us.i.posthog.com',
        person_profiles: 'identified_only' // or 'always' to create profiles for anonymous users as well
    })
              `,
            }}
          />
          <body>
            <div className="wrapper">
              <div className="border-b border-gray-300 py-1 flex justify-between items-center">
                <div>
                  <span className="px-1 pr-2">
                    JLCPCB In-Stock Parts Engine (Unofficial)
                  </span>
                  <span className="">
                    <a href="/">home</a>
                  </span>
                  {pathComponents.map((component, index) => {
                    return (
                      <span key={index}>
                        <span className="px-0.5 text-gray-500">/</span>
                        {index !== pathComponents.length - 1 ? (
                          <span className="px-0.5 text-gray-500">
                            {component}
                          </span>
                        ) : (
                          <a
                            href={`/${pathComponents
                              .slice(0, index + 1)
                              .join("/")}`}
                          >
                            {component}
                          </a>
                        )}
                      </span>
                    )
                  })}
                </div>
                <div className="flex flex-row items-center gap-2">
                  <form
                    action="/components/list"
                    method="GET"
                    className="flex flex-row border-none py-0 my-0"
                  >
                    <input
                      type="text"
                      name="search"
                      placeholder="Search Description, MFR, or LCSC"
                      className="border m-0 mr-2"
                    />
                    <button type="submit" className="border px-3 py-1 m-0">
                      Search
                    </button>
                  </form>
                  <a href="https://github.com/tscircuit/jlcsearch">
                    <img
                      src="https://img.shields.io/github/stars/tscircuit/jlcsearch?style=social"
                      alt="GitHub stars"
                      className="inline-block"
                    />
                  </a>
                  {req.url.includes("/list") && (
                    <a href={`${req.url.replace("/list", "/list.json")}`}>
                      json
                    </a>
                  )}
                  <a href="https://tscircuit.com">tscircuit</a>
                </div>
              </div>
              <div className="flex flex-col text-xs p-1 content">
                {component}
              </div>
              <footer className="footer text-xs">
                © {new Date().getFullYear()} tscircuit. All rights reserved. By
                using this site, you agree to the
                <a href="https://tscircuit.com/legal/terms-of-service.html">
                  terms of service
                </a>
                . This site is from tscircuit not JLCPCB, we are customers
                helping other customers.
              </footer>
            </div>
          </body>
        </html>,
      ),
      {
        headers: {
          "Content-Type": "text/html",
        },
      },
    )
  }

  return await next(req, ctx)
}
