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
