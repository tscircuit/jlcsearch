// The Basic/Promotional Extended catalog includes both permanent basic parts
// and temporarily promoted extended parts. The broader preferred list is not
// interchangeable with this catalog.
const API = "https://jlcpcb.com/api/overseas-pcb-order/v1"
const PAGE_SIZE = 1000

export async function fetchExtendedPromotionalComponents(
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<number[]> {
  const session = await fetcher(`${API}/getAll`, {
    signal: AbortSignal.timeout(30_000),
  })
  if (!session.ok)
    throw new Error("Could not initialize JLCPCB catalog session")
  const token = session.headers
    .getSetCookie()
    .map((cookie) => cookie.match(/^XSRF-TOKEN=([^;]+)/)?.[1])
    .find(Boolean)
  if (!token)
    throw new Error("JLCPCB catalog session did not provide XSRF token")

  const seen = new Set<string>()
  const promotional: number[] = []
  let total: number | undefined
  for (let currentPage = 1; currentPage <= 100; currentPage++) {
    const response = await fetcher(
      `${API}/shoppingCart/smtGood/selectSmtComponentList`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": token },
        body: JSON.stringify({
          currentPage,
          pageSize: PAGE_SIZE,
          componentLibraryType: "base",
          preferredComponentFlag: true,
        }),
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!response.ok)
      throw new Error("JLCPCB promotional catalog request failed")
    const body = await response.json()
    const page = body?.data?.componentPageInfo
    if (
      body?.code !== 200 ||
      !page ||
      !Array.isArray(page.list) ||
      !Number.isSafeInteger(page.total) ||
      page.total <= 0 ||
      (total !== undefined && total !== page.total)
    ) {
      throw new Error("Invalid or changing JLCPCB promotional catalog")
    }
    total = Number(page.total)
    if (page.list.length === 0 || page.list.length > PAGE_SIZE) {
      throw new Error("Incomplete JLCPCB promotional catalog")
    }
    for (const row of page.list) {
      if (
        typeof row?.componentCode !== "string" ||
        !/^C[1-9]\d*$/.test(row.componentCode) ||
        !Number.isSafeInteger(Number(row.componentCode.slice(1))) ||
        !["base", "expand"].includes(row.componentLibraryType) ||
        seen.has(row.componentCode)
      ) {
        throw new Error("Invalid or duplicate JLCPCB promotional catalog row")
      }
      seen.add(row.componentCode)
      if (row.componentLibraryType === "expand") {
        promotional.push(Number(row.componentCode.slice(1)))
      }
    }
    // This endpoint can return hasNextPage=false even when total spans pages.
    if (seen.size === total) {
      if (!promotional.length)
        throw new Error("No extended promotional parts returned")
      return promotional.sort((a, b) => a - b)
    }
    if (seen.size > total || page.list.length !== PAGE_SIZE) {
      throw new Error("Incomplete JLCPCB promotional catalog")
    }
  }
  throw new Error("JLCPCB promotional catalog exceeds pagination limit")
}
