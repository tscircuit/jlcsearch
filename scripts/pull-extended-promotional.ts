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
  // Pagination fields returned by the API (inconsistent across calls)
  hasNextPage?: boolean
  pages?: number
  pageNum?: number
  nextPage?: number
  isLastPage?: boolean
}

type JlcpcbSession = {
  xsrfToken: string
  cookieHeader: string
}

async function getSession(): Promise<JlcpcbSession> {
  const resp = await fetch(
    "https://jlcpcb.com/api/overseas-pcb-order/v1/getAll",
  )
  const setCookie = resp.headers.get("set-cookie") ?? ""

  const xsrfMatch = setCookie.match(/XSRF-TOKEN=([^;]+)/)
  const sessionMatch = setCookie.match(/JLCPCB_SESSION_ID=([^;]+)/)
  if (!xsrfMatch) {
    throw new Error("Failed to get XSRF-TOKEN from JLCPCB")
  }
  const xsrfToken = decodeURIComponent(xsrfMatch[1])
  const cookies = [`XSRF-TOKEN=${xsrfToken}`]
  if (sessionMatch) {
    cookies.push(`JLCPCB_SESSION_ID=${decodeURIComponent(sessionMatch[1])}`)
  }

  return { xsrfToken, cookieHeader: cookies.join("; ") }
}

async function fetchPage(
  page: number,
  session: JlcpcbSession,
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

  let lastError: unknown
  for (let attempt = 1; attempt <= 5; attempt++) {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Origin: "https://jlcpcb.com",
        Referer: "https://jlcpcb.com/parts/basic_parts",
        Cookie: session.cookieHeader,
        "X-XSRF-TOKEN": session.xsrfToken,
      },
      body: JSON.stringify(body),
    })

    let data: any
    try {
      data = await resp.json()
    } catch (err) {
      lastError = err
      const delayMs = 500 * 2 ** (attempt - 1)
      console.error(
        `Failed to parse JSON response, retrying in ${delayMs}ms (attempt ${attempt}/5)...`,
      )
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      continue
    }

    // Handle both response formats (with and without "data" wrapper)
    const cpi = data.componentPageInfo ?? data.data?.componentPageInfo
    if (!cpi) {
      lastError = new Error(
        `Unexpected API response format: ${Object.keys(data).join(", ")}`,
      )
      const delayMs = 500 * 2 ** (attempt - 1)
      console.error(
        `Unexpected API response format, retrying in ${delayMs}ms (attempt ${attempt}/5)...`,
      )
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      continue
    }

    // Some JLCPCB API responses appear to return HTTP 5xx while still
    // containing valid payloads. Treat presence of componentPageInfo as
    // authoritative.
    if (!resp.ok) {
      console.error(
        `Warning: JLCPCB API returned status ${resp.status} but provided componentPageInfo payload. Continuing...`,
      )
    }

    return cpi as PageInfo
  }

  throw lastError ?? new Error("Failed to fetch JLCPCB page after retries")
}

async function main() {
  console.error("Fetching XSRF token from JLCPCB...")
  const session = await getSession()
  console.error("Got XSRF token/session")

  const extendedPromotionalCodes: string[] = []
  let page = 1
  let totalFetched = 0

  while (true) {
    console.error(`Fetching page ${page}...`)
    const cpi = await fetchPage(page, session)
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

    const isLastPage =
      cpi.isLastPage === true ||
      (typeof cpi.pages === "number" &&
        typeof cpi.pageNum === "number" &&
        cpi.pageNum >= cpi.pages)

    if (parts.length === 0 || isLastPage) {
      break
    }

    if (
      typeof cpi.nextPage === "number" &&
      typeof cpi.pageNum === "number" &&
      cpi.nextPage > cpi.pageNum
    ) {
      page = cpi.nextPage
    } else {
      page++
    }

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
