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
  @apply bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded
}
`,
            }}
          />
          <body>
            <div>
              <div className="border-b border-gray-300 py-1 flex justify-between items-center">
                <div>
                  <span className="px-1 pr-2">
                    JLCPCB In-Stock Parts Engine (Unofficial)
                  </span>
                  {pathComponents.map((component, index) => {
                    return (
                      <span key={index}>
                        <span className="px-0.5 text-gray-500">/</span>
                        <a
                          href={`/${pathComponents.slice(0, index + 1).join("/")}`}
                        >
                          {component}
                        </a>
                      </span>
                    )
                  })}
                </div>
              </div>
              <div className="flex flex-col text-xs p-1">{component}</div>
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
