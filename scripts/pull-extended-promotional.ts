/**
 * Pull JLCPCB extended promotional LCSC codes.
 *
 * The JLCPCB "Basic/Promotional Extended Parts" page queries the SMT parts API
 * with componentLibraryType="base" and preferredComponentFlag=true. Parts that
 * appear in that result set with componentLibraryType="expand" are extended
 * promotional parts. This script prints their LCSC codes, one per line.
 */

const API_URL =
  "https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList/v2"
const PAGE_SIZE = 500

interface SmtComponent {
  componentCode?: string
  componentLibraryType?: string
}

interface ComponentPageInfo {
  total?: number
  list?: SmtComponent[]
  pages?: number
  hasNextPage?: boolean
}

interface JlcAuth {
  xsrfToken: string
  cookieHeader: string
}

const getCookieValue = (setCookieHeader: string, cookieName: string) => {
  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;]+)`))
  return match ? decodeURIComponent(match[1]!) : null
}

const getJlcAuth = async (): Promise<JlcAuth> => {
  const response = await fetch(
    "https://jlcpcb.com/api/overseas-pcb-order/v1/getAll",
    {
      headers: {
        Referer: "https://jlcpcb.com/parts/basic_parts",
        "User-Agent":
          "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    },
  )
  const setCookie = response.headers.get("set-cookie") ?? ""
  const token = getCookieValue(setCookie, "XSRF-TOKEN")

  if (!token) {
    throw new Error("Could not read XSRF-TOKEN from JLCPCB response")
  }

  const sessionId = getCookieValue(setCookie, "JLCPCB_SESSION_ID")
  const cookieParts = [`XSRF-TOKEN=${encodeURIComponent(token)}`]
  if (sessionId) {
    cookieParts.push(`JLCPCB_SESSION_ID=${encodeURIComponent(sessionId)}`)
  }

  return {
    xsrfToken: token,
    cookieHeader: cookieParts.join("; "),
  }
}

const fetchPage = async (
  currentPage: number,
  auth: JlcAuth,
): Promise<ComponentPageInfo> => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Cookie: auth.cookieHeader,
      Origin: "https://jlcpcb.com",
      Referer: "https://jlcpcb.com/parts/basic_parts",
      "User-Agent":
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      "X-XSRF-TOKEN": auth.xsrfToken,
    },
    body: JSON.stringify({
      currentPage,
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
    }),
  })

  const responseText = await response.text()
  const json = JSON.parse(responseText)
  const pageInfo = json.componentPageInfo ?? json.data?.componentPageInfo

  if (!pageInfo) {
    throw new Error(
      `JLCPCB API returned ${response.status} without componentPageInfo: ${responseText.slice(0, 500)}`,
    )
  }

  return pageInfo
}

const main = async () => {
  const auth = await getJlcAuth()
  const codes = new Set<string>()
  let currentPage = 1
  let totalSeen = 0

  while (true) {
    const pageInfo = await fetchPage(currentPage, auth)
    const parts = pageInfo.list ?? []

    totalSeen += parts.length

    for (const part of parts) {
      if (
        part.componentLibraryType === "expand" &&
        part.componentCode?.trim()
      ) {
        codes.add(part.componentCode.trim())
      }
    }

    console.error(
      `page ${currentPage}: saw ${parts.length} parts (${totalSeen}/${pageInfo.total ?? "?"}), found ${codes.size} extended promotional`,
    )

    const hasMorePages =
      pageInfo.pages != null
        ? currentPage < pageInfo.pages
        : pageInfo.total != null
          ? totalSeen < pageInfo.total
          : pageInfo.hasNextPage === true

    if (!hasMorePages || parts.length === 0) break
    currentPage += 1
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  if (codes.size === 0) {
    throw new Error("No extended promotional parts found from JLCPCB API")
  }

  for (const code of codes) {
    console.log(code)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
