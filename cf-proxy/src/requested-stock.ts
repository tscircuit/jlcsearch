export const EXACT_STOCK_MAX_AGE = 6 * 3600

export function exactLcsc(query: string | null | undefined): number | null {
  const text = query?.trim() ?? ""
  if (!/^C?[1-9]\d*$/i.test(text)) return null
  const lcsc = Number(text.replace(/^c/i, ""))
  return Number.isSafeInteger(lcsc) ? lcsc : null
}

export interface VerifiedComponent {
  lcsc: number
  mfr: string
  package: string
  description: string
  is_basic: boolean
  is_preferred: boolean
  stock: number
  price: number | null
}

// Never accept a fuzzy substitute or infer zero from an empty supplier result.
export async function fetchExactStock(
  lcsc: number,
  fetcher: typeof fetch = fetch,
): Promise<VerifiedComponent> {
  if (exactLcsc(String(lcsc)) === null) throw new Error("Invalid LCSC number")
  const response = await fetcher(
    "https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList/v2",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        currentPage: 1,
        pageSize: 25,
        keyword: `C${lcsc}`,
        searchSource: "search",
        searchType: 2,
        componentBrandList: [],
        componentSpecificationList: [],
        componentAttributeList: [],
        paramList: [],
      }),
    },
  )
  if (!response.ok) throw new Error(`JLCPCB HTTP ${response.status}`)
  const body: any = await response.json()
  const list = body.data?.componentPageInfo?.list
  if (body.code !== 200 || !Array.isArray(list))
    throw new Error("Invalid JLCPCB inventory response")
  const matches = list.filter((row: any) => row.componentCode === `C${lcsc}`)
  if (matches.length !== 1)
    throw new Error(`Exact part C${lcsc} not returned by JLCPCB`)
  const row = matches[0]
  if (
    !Number.isSafeInteger(row.stockCount) ||
    row.stockCount < 0 ||
    typeof row.componentModelEn !== "string" ||
    !row.componentModelEn.trim()
  )
    throw new Error(`Invalid inventory for C${lcsc}`)
  return {
    lcsc,
    mfr: row.componentModelEn,
    package:
      typeof row.componentSpecificationEn === "string"
        ? row.componentSpecificationEn
        : "",
    description: typeof row.describe === "string" ? row.describe : "",
    is_basic: row.componentLibraryType === "base",
    is_preferred: row.preferredComponentFlag === true,
    stock: row.stockCount,
    price:
      typeof row.initialPrice === "number" &&
      Number.isFinite(row.initialPrice) &&
      row.initialPrice >= 0
        ? row.initialPrice
        : null,
  }
}

export async function requestStock(db: D1Database, lcsc: number) {
  await db
    .prepare(`INSERT INTO _jlcsearch_requested_parts (lcsc, requested_at)
    VALUES (?, unixepoch()) ON CONFLICT(lcsc) DO UPDATE SET requested_at=excluded.requested_at
    WHERE requested_at < unixepoch() - 3600`)
    .bind(lcsc)
    .run()
}

export async function readRequestedStock(db: D1Database, lcsc: number) {
  const row = await db
    .prepare(`SELECT component_json, verified_at FROM _jlcsearch_requested_parts
    WHERE lcsc=? AND component_json IS NOT NULL`)
    .bind(lcsc)
    .first<{ component_json: string; verified_at: number }>()
  if (!row) return null
  const component: VerifiedComponent = JSON.parse(row.component_json)
  return {
    ...component,
    stock:
      row.verified_at >= Math.floor(Date.now() / 1000) - EXACT_STOCK_MAX_AGE
        ? component.stock
        : null,
    stock_checked_at: new Date(row.verified_at * 1000).toISOString(),
  }
}
