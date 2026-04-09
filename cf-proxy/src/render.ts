import {
  ROUTE_TO_TABLE,
  TABLE_CONFIGS,
  TABLE_RESPONSE_KEY,
  type QueryParams,
  type FilterOptions,
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

const FALLBACK_FILTER_OPTIONS: FilterOptions = {
  color: [
    "RGB",
    "red",
    "green",
    "blue",
    "white",
    "yellow",
    "orange",
    "amber",
    "pink",
    "purple",
    "emerald",
  ],
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

const SI_PREFIXES = [
  { value: 1e12, symbol: "T" },
  { value: 1e9, symbol: "G" },
  { value: 1e6, symbol: "M" },
  { value: 1e3, symbol: "k" },
  { value: 1, symbol: "" },
  { value: 1e-3, symbol: "m" },
  { value: 1e-6, symbol: "u" },
  { value: 1e-9, symbol: "n" },
  { value: 1e-12, symbol: "p" },
]

const formatSiUnit = (value: unknown): string => {
  const num = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(num)) return ""
  if (num === 0) return "0"

  const prefix =
    SI_PREFIXES.find((candidate) => Math.abs(num) >= candidate.value) ||
    SI_PREFIXES[SI_PREFIXES.length - 1]
  const scaled = num / prefix.value
  const formatted = scaled
    .toPrecision(3)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1")

  return `${formatted}${prefix.symbol}`
}

const COLUMN_LABELS: Record<string, string> = {
  lcsc: "LCSC",
  mfr: "MFR",
  price1: "Price",
  in_stock: "In Stock",
  is_basic: "Basic",
  is_preferred: "Preferred",
  capacitance_farads: "Capacitance",
  tolerance_fraction: "Tolerance",
  voltage_rating: "Voltage",
  current_rating: "Current",
  resistance: "Resistance",
  power_watts: "Power",
  current_rating_a: "Current",
  current_rating_amp: "Current",
  voltage_rating_volt: "Voltage",
  wavelength_nm: "Wavelength",
  luminous_intensity_mcd: "Intensity",
  number_of_contacts: "Contacts",
  num_channels: "Channels",
  num_bits: "Bits",
  num_pins: "Pins",
  num_pins_per_row: "Pins / Row",
  num_rows: "Rows",
  pin_count: "Pins",
  channel_count: "Channels",
  relay_type: "Relay Type",
  switch_type: "Switch Type",
  contact_type: "Contact Type",
  output_type: "Output Type",
  mounting_style: "Mounting",
  cpu_core: "Core",
  cpu_speed_hz: "CPU Speed",
  flash_size_bytes: "Flash",
  ram_size_bytes: "RAM",
  gpio_count: "GPIO",
  clock_frequency_hz: "Clock",
  frequency_ghz: "Frequency",
  display_type: "Display Type",
  matrix_size: "Matrix Size",
  forward_current: "Forward Current",
  forward_voltage: "Forward Voltage",
  supply_voltage_min: "Min Voltage",
  supply_voltage_max: "Max Voltage",
  output_voltage_min: "Min Output Voltage",
  output_voltage_max: "Max Output Voltage",
  input_voltage_min: "Min Input Voltage",
  input_voltage_max: "Max Input Voltage",
  output_current_max: "Max Output Current",
  operating_temp_min: "Min Temp",
  operating_temp_max: "Max Temp",
  pitch_mm: "Pitch",
}

const getColumnLabel = (column: string): string => {
  if (COLUMN_LABELS[column]) return COLUMN_LABELS[column]
  return titleCase(column)
}

const withUnit = (value: unknown, unit: string): string => {
  const num = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(num)) return ""
  return `${num}${unit}`
}

const formatByteSize = (value: unknown): string => {
  const num = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(num)) return ""
  if (num >= 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)}MB`
  if (num >= 1024) return `${(num / 1024).toFixed(1)}KB`
  return `${num}B`
}

const formatCount = (value: unknown): string => {
  const num = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(num)) return ""
  return Number.isInteger(num) ? num.toLocaleString("en-US") : String(num)
}

const formatDisplayValue = (column: string, value: unknown): string | null => {
  switch (column) {
    case "capacitance_farads":
      return `${formatSiUnit(value)}F`
    case "resistance":
      return `${formatSiUnit(value)}Ω`
    case "tolerance_fraction": {
      const num = typeof value === "number" ? value : Number(value)
      if (!Number.isFinite(num)) return ""
      return `±${num * 100}%`
    }
    case "power_watts":
      return `${formatSiUnit(value)}W`
    case "stock":
      return formatCount(value)
    case "cpu_speed_hz":
    case "sampling_rate_hz":
    case "clock_frequency_hz":
      return `${formatSiUnit(value)}Hz`
    case "frequency_ghz":
      return withUnit(value, "GHz")
    case "wavelength_nm":
      return withUnit(value, "nm")
    case "luminous_intensity_mcd":
      return withUnit(value, "mcd")
    case "flash_size_bytes":
    case "ram_size_bytes":
    case "eeprom_size_bytes":
    case "embedded_ram_bits":
      return formatByteSize(value)
    case "num_channels":
    case "num_bits":
    case "num_pins":
    case "num_pins_per_row":
    case "num_rows":
    case "pin_count":
    case "channel_count":
    case "number_of_contacts":
    case "gpio_count":
      return formatCount(value)
    case "current_rating":
    case "current_rating_a":
    case "current_rating_amp":
    case "forward_current":
    case "collector_current":
    case "continuous_drain_current":
    case "output_current_max":
    case "ripple_current_amps":
      return `${formatSiUnit(value)}A`
    case "voltage_rating":
    case "forward_voltage":
    case "reverse_voltage":
    case "collector_emitter_voltage":
    case "drain_source_voltage":
    case "gate_threshold_voltage":
    case "supply_voltage_min":
    case "supply_voltage_max":
    case "input_voltage_min":
    case "input_voltage_max":
    case "output_voltage_min":
    case "output_voltage_max":
    case "dropout_voltage":
    case "coil_voltage":
      return withUnit(value, "V")
    case "pitch_mm":
    case "display_size":
    case "pin_length_mm":
    case "row_spacing_mm":
    case "insulation_height_mm":
    case "width_mm":
    case "length_mm":
    case "switch_height_mm":
      return withUnit(value, "mm")
    case "operating_temp_min":
    case "operating_temp_max":
    case "operating_temperature_min":
    case "operating_temperature_max":
      return withUnit(value, "°C")
    default:
      return null
  }
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
    return value ? "✓" : ""
  }
  const formatted = formatDisplayValue(column, value)
  if (formatted !== null) {
    return escapeHtml(formatted)
  }
  return escapeHtml(value)
}

const renderTable = (rows: unknown[]): string => {
  if (rows.length === 0) return ""
  const firstRow = rows[0] as Record<string, unknown>
  const columns = Object.keys(firstRow)
  const headerHtml = columns
    .map(
      (column) =>
        `<th class="p-1 border border-gray-300">${escapeHtml(getColumnLabel(column))}</th>`,
    )
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

const renderFilterSuggestions = (
  pathname: string,
  paramName: string,
  options: string[],
): string => {
  if (options.length === 0) return ""

  const listId = `${pathname.replaceAll("/", "-")}-${paramName}-options`
  return `<datalist id="${escapeHtml(listId)}">${options
    .map((option) => `<option value="${escapeHtml(option)}"></option>`)
    .join("")}</datalist>`
}

const getSuggestionListId = (
  pathname: string,
  paramName: string,
  options: string[],
): string =>
  options.length > 0 ? `${pathname.replaceAll("/", "-")}-${paramName}-options` : ""

const renderCustomFilters = (
  pathname: string,
  params: QueryParams,
  filterOptions: FilterOptions = {},
): string => {
  switch (pathname) {
    case "/analog_switches/list": {
      const packageOptions = filterOptions.package ?? []
      const channelOptions = filterOptions.channels ?? []
      const packageListId = getSuggestionListId(
        pathname,
        "package",
        packageOptions,
      )

      return `<form method="GET" class="flex flex-row gap-4">
        <div>
          <label>Package:</label>
          <input type="text" name="package" value="${escapeHtml(params.package ?? "")}"${packageListId ? ` list="${escapeHtml(packageListId)}"` : ""} autocomplete="on" />
          ${renderFilterSuggestions(pathname, "package", packageOptions)}
        </div>
        <div>
          <label>Channels:</label>
          <select name="channels">
            <option value="">All</option>
            ${channelOptions
              .map(
                (option) =>
                  `<option value="${escapeHtml(option)}"${params.channels === option ? " selected" : ""}>${escapeHtml(option)}</option>`,
              )
              .join("")}
          </select>
        </div>
        <button type="submit">Filter</button>
      </form>`
    }
    case "/arm_processors/list":
    case "/risc_v_processors/list": {
      const packageOptions = filterOptions.package ?? []
      const packageListId = getSuggestionListId(
        pathname,
        "package",
        packageOptions,
      )

      return `<form method="GET" class="flex flex-row gap-4">
        <div>
          <label>Package:</label>
          <input type="text" name="package" value="${escapeHtml(params.package ?? "")}"${packageListId ? ` list="${escapeHtml(packageListId)}"` : ""} autocomplete="on" />
          ${renderFilterSuggestions(pathname, "package", packageOptions)}
        </div>
        <div>
          <label>Min Flash:</label>
          <input type="number" name="flash_min" value="${escapeHtml(params.flash_min ?? "")}" step="any" />
        </div>
        <div>
          <label>Min RAM:</label>
          <input type="number" name="ram_min" value="${escapeHtml(params.ram_min ?? "")}" step="any" />
        </div>
        <div>
          <label>Interface:</label>
          <select name="interface">
            <option value="">All</option>
            ${["uart", "i2c", "spi", "can", "usb"]
              .map(
                (option) =>
                  `<option value="${escapeHtml(option)}"${params.interface === option ? " selected" : ""}>${escapeHtml(option.toUpperCase())}</option>`,
              )
              .join("")}
          </select>
        </div>
        <button type="submit">Filter</button>
      </form>`
    }
    case "/microphones/list": {
      const packageOptions = filterOptions.package ?? []
      const typeOptions = filterOptions.microphone_type ?? ["all"]
      const packageListId = getSuggestionListId(
        pathname,
        "package",
        packageOptions,
      )

      return `<form method="GET" class="flex flex-row gap-4">
        <div>
          <label>Package:</label>
          <input type="text" name="package" value="${escapeHtml(params.package ?? "")}"${packageListId ? ` list="${escapeHtml(packageListId)}"` : ""} autocomplete="on" />
          ${renderFilterSuggestions(pathname, "package", packageOptions)}
        </div>
        <div>
          <label>Type:</label>
          <select name="microphone_type">
            ${typeOptions
              .map((option) => {
                const selected =
                  (params.microphone_type ?? "all") === option ? " selected" : ""
                return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option === "all" ? "All" : option)}</option>`
              })
              .join("")}
          </select>
        </div>
        <button type="submit">Filter</button>
      </form>`
    }
    default:
      return ""
  }
}

const renderGenericFilters = (
  pathname: string,
  params: QueryParams,
  filterOptions: FilterOptions = {},
): string => {
  const tableName = ROUTE_TO_TABLE[pathname]
  if (!tableName) return ""
  const config = TABLE_CONFIGS[tableName]
  if (!config) return ""

  const inputs = Object.entries(config.filters)
    .map(([paramName, fieldConfig]) => {
      const label = getColumnLabel(paramName)
      const mergedSuggestions = Array.from(
        new Set([
          ...(filterOptions[paramName] ?? []),
          ...(FALLBACK_FILTER_OPTIONS[paramName] ?? []),
        ]),
      )
      if (fieldConfig.type === "boolean") {
        return `<div><label>${escapeHtml(label)}:</label><select name="${escapeHtml(paramName)}"><option value="">All</option><option value="true"${params[paramName] === "true" ? " selected" : ""}>Yes</option><option value="false"${params[paramName] === "false" ? " selected" : ""}>No</option></select></div>`
      }
      const inputType = fieldConfig.type === "number" ? "number" : "text"
      const step = fieldConfig.type === "number" ? ' step="any"' : ""
      const listId =
        mergedSuggestions.length > 0
          ? `${pathname.replaceAll("/", "-")}-${paramName}-options`
          : ""
      return `<div><label>${escapeHtml(label)}:</label><input type="${inputType}" name="${escapeHtml(paramName)}" value="${escapeHtml(params[paramName] ?? "")}"${step}${listId ? ` list="${escapeHtml(listId)}"` : ""} autocomplete="on" />${renderFilterSuggestions(pathname, paramName, mergedSuggestions)}</div>`
    })
    .join("")

  return `<form method="GET" class="flex flex-row gap-4">${inputs}<button type="submit">Filter</button></form>`
}

const renderComponentsFilters = (
  params: QueryParams,
): string => `<form method="GET" class="flex flex-row gap-4">
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
            <input type="text" name="search" placeholder="Search Description, MFR, or LCSC" class="border m-0 mr-2" autocomplete="on" />
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
  filterOptions?: FilterOptions,
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
    pageBody +=
      renderCustomFilters(pathname, params, filterOptions) ||
      renderGenericFilters(pathname, params, filterOptions)
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
