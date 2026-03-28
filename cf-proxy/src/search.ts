import type { Kysely } from "kysely"
import type { DB } from "./db/types"

export interface SearchQueryParams {
  q?: string
  package?: string
  limit?: string
}

const tokenizeSearchTerm = (term: string): string[] =>
  term.toLowerCase().match(/[a-z0-9]+/g) ?? []

export async function searchIndex(
  db: Kysely<DB>,
  params: SearchQueryParams,
): Promise<
  Array<{
    lcsc: number | null
    mfr: string | null
    package: string | null
    description: string | null
    stock: number | null
    price1: number | null
    source_table: string | null
  }>
> {
  const limit = Number.parseInt(params.limit ?? "100", 10) || 100

  let query = db
    .selectFrom("search_index")
    .selectAll()
    .where("stock", ">", 0)
    .orderBy("stock", "desc")
    .limit(limit)

  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  if (params.q) {
    const raw = params.q.trim()

    if (/^c?\d+$/i.test(raw)) {
      const normalized = raw.toLowerCase().startsWith("c") ? raw.slice(1) : raw
      const lcsc = Number.parseInt(normalized, 10)
      if (!Number.isNaN(lcsc)) {
        query = query.where("lcsc", "=", lcsc)
      }
    } else {
      const tokens = tokenizeSearchTerm(raw)
      const searchTokens = tokens.length > 0 ? tokens : [raw.toLowerCase()]

      for (const token of searchTokens) {
        const pattern = `%${token}%`
        query = query.where((eb) =>
          eb("mfr", "like", pattern)
            .or("description", "like", pattern)
            .or("package", "like", pattern),
        )
      }
    }
  }

  return await query.execute()
}
