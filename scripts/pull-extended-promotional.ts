/**
 * Pull extended promotional component LCSC codes from the JLCPCB API.
 *
 * JLCPCB's "Basic/Promotional Extended Parts" page shows parts returned by
 * querying with componentLibraryType="base" and preferredComponentFlag=true.
 * Among these results, parts with componentLibraryType="expand" are the
 * "extended promotional" parts — extended parts temporarily promoted to
 * basic-tier assembly pricing.
 *
 * This script fetches all such parts and outputs their LCSC codes to stdout,
 * one per line, suitable for piping into the DB update script.
 *
 * Usage:
 *   bun run scripts/pull-extended-promotional.ts > extended_promotional_codes.txt
 */

const API_URL =
  "https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList/v2"
const PAGE_SIZE = 500

interface ComponentResult {
  componentCode: string
  componentLibraryType: string
  preferredComponentFlag: boolean
}

interface PageInfo {
  total: number
  list: ComponentResult[]
  hasNextPage: boolean
}

async function getXsrfToken(): Promise<string> {
  const resp = await fetch(
    "https://jlcpcb.com/api/overseas-pcb-order/v1/getAll",
  )
  const setCookie = resp.headers.get("set-cookie") ?? ""
  const match = setCookie.match(/XSRF-TOKEN=([^;]+)/)
  if (!match) {
    throw new Error("Failed to get XSRF-TOKEN from JLCPCB")
  }
  return decodeURIComponent(match[1])
}

async function fetchPage(
  page: number,
  xsrfToken: string,
): Promise<PageInfo> {
  const body = {
    currentPage: page,
    pageSize: PAGE_SIZE,
    keyword: null,
    componentLibraryType: "base",
    preferredComponentFlag: true,
    stockFlag: null,
    stockSort: null,
    firstSortName: null,
    secondSortName: null,
    componentBrand: null,
    componentSpecification: null,
    componentAttributes: [],
    searchSource: "search",
  }

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Origin: "https://jlcpcb.com",
      Referer: "https://jlcpcb.com/parts/basic_parts",
      "X-XSRF-TOKEN": xsrfToken,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    throw new Error(`JLCPCB API returned status ${resp.status}`)
  }

  const data = await resp.json()

  // Handle both response formats (with and without "data" wrapper)
  const cpi = data.componentPageInfo ?? data.data?.componentPageInfo
  if (!cpi) {
    throw new Error(
      `Unexpected API response format: ${Object.keys(data).join(", ")}`,
    )
  }

  return cpi as PageInfo
}

async function main() {
  console.error("Fetching XSRF token from JLCPCB...")
  const xsrfToken = await getXsrfToken()
  console.error("Got XSRF token")

  const extendedPromotionalCodes: string[] = []
  let page = 1
  let totalFetched = 0

  while (true) {
    console.error(`Fetching page ${page}...`)
    const cpi = await fetchPage(page, xsrfToken)
    const parts = cpi.list ?? []
    totalFetched += parts.length

    // Extended promotional parts are "expand" type appearing in the
    // basic+preferred query results
    for (const part of parts) {
      if (part.componentLibraryType === "expand") {
        extendedPromotionalCodes.push(part.componentCode)
      }
    }

    console.error(
      `  Got ${parts.length} parts (${totalFetched}/${cpi.total}), ` +
        `extended promotional so far: ${extendedPromotionalCodes.length}`,
    )

    if (!cpi.hasNextPage || parts.length === 0) {
      break
    }
    page++

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  console.error(
    `\nDone! Found ${extendedPromotionalCodes.length} extended promotional components ` +
      `out of ${totalFetched} total basic+preferred parts.`,
  )

  // Output LCSC codes to stdout, one per line
  for (const code of extendedPromotionalCodes) {
    console.log(code)
  }
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
