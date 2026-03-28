import {
  ROUTE_TO_TABLE,
  TABLE_CONFIGS,
  TABLE_RESPONSE_KEY,
  type QueryParams,
} from "./handlers"

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const routeLabels: Record<string, string> = {
  "/categories/list": "Categories",
  "/footprint_index/list": "Footprint Index",
  "/resistors/list": "Resistors",
  "/resistor_arrays/list": "Resistor Arrays",
  "/capacitors/list": "Capacitors",
  "/potentiometers/list": "Potentiometers",
  "/headers/list": "Headers",
  "/usb_c_connectors/list": "USB-C Connectors",
  "/pcie_m2_connectors/list": "PCIe M.2 Connectors",
  "/fpc_connectors/list": "FPC Connectors",
  "/jst_connectors/list": "JST Connectors",
  "/wire_to_board_connectors/list": "Wire to Board Connectors",
  "/battery_holders/list": "Battery Holders",
  "/leds/list": "LEDs",
  "/adcs/list": "ADCs",
  "/analog_multiplexers/list": "Analog Muxes",
  "/analog_switches/list": "Analog Switches",
  "/io_expanders/list": "I/O Expanders",
  "/gyroscopes/list": "Gyroscopes",
  "/accelerometers/list": "Accelerometers",
  "/gas_sensors/list": "Gas Sensors",
  "/microphones/list": "Microphones",
  "/diodes/list": "Diodes",
  "/dacs/list": "DACs",
  "/wifi_modules/list": "WiFi Modules",
  "/microcontrollers/list": "Microcontrollers",
  "/arm_processors/list": "ARM Processors",
  "/risc_v_processors/list": "RISC-V Processors",
  "/fpgas/list": "FPGAs & CPLDs",
  "/voltage_regulators/list": "Voltage Regulators",
  "/ldos/list": "LDO Regulators",
  "/boost_converters/list": "Boost DC-DC Converters",
  "/buck_boost_converters/list": "Buck-Boost DC-DC Converters",
  "/led_drivers/list": "LED Drivers",
  "/mosfets/list": "Mosfets",
  "/led_with_ic/list": "LED with ICs",
  "/led_dot_matrix_display/list": "LED Dot Matrix Displays Modules",
  "/oled_display/list": " OLED Displays Modules",
  "/led_segment_display/list": "LED Segment Display Modules",
  "/lcd_display/list": "LCD Display Modules",
  "/switches/list": "Switches",
  "/relays/list": "Relays",
  "/fuses/list": "Fuses",
  "/bjt_transistors/list": "BJT Transistors",
}

const routeHeadings: Record<string, string> = {
  "/categories/list": "Categories",
  "/components/list": "Components",
  "/footprint_index/list": "Package Index",
  "/led_with_ic/list": "LEDs with Built-in IC",
}

const titleCase = (value: string): string =>
  value
    .split(/[_/]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")

const getPageTitle = (pathname: string): string => {
  if (routeLabels[pathname]) return routeLabels[pathname]
  const tableName = ROUTE_TO_TABLE[pathname]
  if (tableName) return titleCase(tableName)
  if (pathname === "/components/list") return "JLCPCB Component Search"
  return "JLCPCB Parts Search"
}

const getPageHeading = (pathname: string): string =>
  routeHeadings[pathname] ?? getPageTitle(pathname)

const formatPrice = (value: unknown): string => {
  const price = typeof value === "number" ? value : Number(value)
  if (!price) return ""
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

const renderCell = (
  row: Record<string, unknown>,
  column: string,
  value: unknown,
): string => {
  if (value === null || value === undefined || value === "") return ""
  if (column === "lcsc") {
    return `<a href="https://jlcpcb.com/partdetail/${escapeHtml(row.mfr)}/C${escapeHtml(value)}">${escapeHtml(value)}</a>`
  }
  if (column === "price" || column === "price1") {
    return escapeHtml(formatPrice(value))
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }
  return escapeHtml(value)
}

const renderTable = (rows: unknown[]): string => {
  if (rows.length === 0) return ""
  const firstRow = rows[0] as Record<string, unknown>
  const columns = Object.keys(firstRow)
  const headerHtml = columns
    .map((column) => `<th class="p-1 border border-gray-300">${escapeHtml(column)}</th>`)
    .join("")

  const bodyHtml = rows
    .map((row) => {
      const record = row as Record<string, unknown>
      const cells = columns
        .map(
          (column) =>
            `<td class="border border-gray-300 p-1">${renderCell(record, column, record[column])}</td>`,
        )
        .join("")
      return `<tr>${cells}</tr>`
    })
    .join("")

  return `<table class="border border-gray-300 text-xs border-collapse p-1"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
}

const renderGenericFilters = (pathname: string, params: QueryParams): string => {
  const tableName = ROUTE_TO_TABLE[pathname]
  if (!tableName) return ""
  const config = TABLE_CONFIGS[tableName]
  if (!config) return ""

  const inputs = Object.entries(config.filters)
    .map(([paramName, fieldConfig]) => {
      if (fieldConfig.type === "boolean") {
        return `<div><label>${escapeHtml(paramName)}:</label><select name="${escapeHtml(paramName)}"><option value="">All</option><option value="true"${params[paramName] === "true" ? " selected" : ""}>true</option><option value="false"${params[paramName] === "false" ? " selected" : ""}>false</option></select></div>`
      }
      const inputType = fieldConfig.type === "number" ? "number" : "text"
      const step = fieldConfig.type === "number" ? ' step="any"' : ""
      return `<div><label>${escapeHtml(paramName)}:</label><input type="${inputType}" name="${escapeHtml(paramName)}" value="${escapeHtml(params[paramName] ?? "")}"${step} /></div>`
    })
    .join("")

  return `<form method="GET" class="flex flex-row gap-4">${inputs}<button type="submit">Filter</button></form>`
}

const renderComponentsFilters = (params: QueryParams): string => `<form method="GET" class="flex flex-row gap-4">
  <input type="hidden" name="subcategory_name" value="${escapeHtml(params.subcategory_name ?? "")}" />
  <input type="hidden" name="package" value="${escapeHtml(params.package ?? "")}" />
  <input type="hidden" name="search" value="${escapeHtml(params.search ?? "")}" />
  <div>
    <label>Basic Part:<input type="checkbox" name="is_basic" value="true"${params.is_basic === "true" ? " checked" : ""} /></label>
  </div>
  <div>
    <label>Preferred Part:<input type="checkbox" name="is_preferred" value="true"${params.is_preferred === "true" ? " checked" : ""} /></label>
  </div>
  <button type="submit">Filter</button>
</form>`

const renderBreadcrumbs = (pathname: string): string => {
  const parts = pathname.split("/").filter(Boolean)
  return parts
    .map((part, index) => {
      const isLast = index === parts.length - 1
      const href = `/${parts.slice(0, index + 1).join("/")}`
      return `<span><span class="px-0.5 text-gray-500">/</span>${isLast ? `<a href="${href}">${escapeHtml(part)}</a>` : `<span class="px-0.5 text-gray-500">${escapeHtml(part)}</span>`}</span>`
    })
    .join("")
}

const renderShell = (
  pathname: string,
  body: string,
  title?: string,
  requestUrl?: string,
): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title || "JLCPCB Parts Search")}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style type="text/tailwindcss">
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
    </style>
    <script>
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('phc_htd8AQjSfVEsFCLQMAiUooG4Q0DKBCjqYuQglc9V3Wo', { api_host:'https://us.i.posthog.com', person_profiles: 'identified_only' })
    </script>
  </head>
  <body>
    <div class="wrapper">
      <div class="border-b border-gray-300 py-1 flex justify-between items-center">
        <div>
          <span class="px-1 pr-2">JLCPCB In-Stock Parts Engine (Unofficial)</span>
          <span><a href="/">home</a></span>
          ${renderBreadcrumbs(pathname)}
        </div>
        <div class="flex flex-row items-center gap-2">
          <form action="/components/list" method="GET" class="flex flex-row border-none py-0 my-0">
            <input type="text" name="search" placeholder="Search Description, MFR, or LCSC" class="border m-0 mr-2" />
            <button type="submit" class="border px-3 py-1 m-0">Search</button>
          </form>
          <a href="https://github.com/tscircuit/jlcsearch">
            <img src="https://img.shields.io/github/stars/tscircuit/jlcsearch?style=social" alt="GitHub stars" class="inline-block" />
          </a>
          ${pathname.includes("/list") ? `<a href="${escapeHtml((requestUrl || pathname).replace("/list", "/list.json"))}">json</a>` : ""}
          <a href="https://raw.githubusercontent.com/tscircuit/jlcsearch/refs/heads/main/docs/openapi.json">OpenAPI</a>
          <a href="https://tscircuit.com">tscircuit</a>
        </div>
      </div>
      <div class="flex flex-col text-xs p-1 content">${body}</div>
      <footer class="footer text-xs">© ${new Date().getFullYear()} tscircuit. All rights reserved. By using this site, you agree to the<a href="https://tscircuit.com/legal/terms-of-service.html">terms of service</a>. This site is from tscircuit not JLCPCB, we are customers helping other customers.</footer>
    </div>
  </body>
</html>`

export const renderHomePage = (): string => {
  const links = Object.entries(routeLabels)
    .map(
      ([href, label]) =>
        `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`,
    )
    .join("")

  return renderShell(
    "/",
    `<div><div class="flex flex-wrap gap-4 *:text-lg *:border *:rounded *:p-2 *:border-gray-300 *:w-32 *:text-sm *:text-center">${links}</div></div>`,
  )
}

export const renderD1TablePage = (
  pathname: string,
  data: Record<string, unknown[]>,
  params: QueryParams,
  requestUrl?: string,
): string => {
  const responseKey =
    TABLE_RESPONSE_KEY[ROUTE_TO_TABLE[pathname] ?? ""] ||
    Object.keys(data)[0] ||
    "results"
  const rows = data[responseKey] ?? []

  let pageBody = `<div><h2>${escapeHtml(getPageHeading(pathname))}</h2>`

  if (pathname === "/components/list") {
    pageBody += renderComponentsFilters(params)
    if (params.subcategory_name) {
      pageBody += `<div>Filtering by subcategory: ${escapeHtml(params.subcategory_name)}</div>`
    }
  } else if (pathname === "/categories/list") {
    pageBody += "<div>Click for subcategories</div>"
  } else {
    pageBody += renderGenericFilters(pathname, params)
  }

  if (rows.length > 0) {
    pageBody += renderTable(rows)
  }
  pageBody += "</div>"

  const title =
    pathname === "/components/list" && params.search
      ? `${params.search} - JLCPCB Component Search`
      : getPageTitle(pathname)

  return renderShell(pathname, pageBody, title, requestUrl)
}
