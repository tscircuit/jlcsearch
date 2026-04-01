import { sql, type Kysely, type RawBuilder } from "kysely"
import type { DB } from "./db/types"

export interface SearchQueryParams {
  q?: string
  package?: string
  limit?: string
  is_basic?: string
  is_preferred?: string
}

interface SearchRow {
  lcsc: number | null
  mfr: string | null
  package: string | null
  description: string | null
  stock: number | null
  price: string | null
  price1: number | null
  basic: number | null
  preferred: number | null
}

const tokenizeSearchTerm = (term: string): string[] =>
  term.toLowerCase().match(/[a-z0-9]+/g) ?? []

const buildWhereClause = (conditions: RawBuilder<unknown>[]) =>
  conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1 = 1`

export async function searchIndex(
  db: Kysely<DB>,
  params: SearchQueryParams,
): Promise<SearchRow[]> {
  const limit = Number.parseInt(params.limit ?? "100", 10) || 100
  const conditions: RawBuilder<unknown>[] = [sql`stock > 0`]

  if (params.package) {
    conditions.push(sql`package = ${params.package}`)
  }

  if (params.is_basic === "true" || params.is_basic === "1") {
    conditions.push(sql`basic = 1`)
  }

  if (params.is_preferred === "true" || params.is_preferred === "1") {
    conditions.push(sql`preferred = 1`)
  }

  const raw = params.q?.trim()

  if (raw) {
    if (/^c?\d+$/i.test(raw)) {
      const normalized = raw.toLowerCase().startsWith("c") ? raw.slice(1) : raw
      const lcsc = Number.parseInt(normalized, 10)
      if (!Number.isNaN(lcsc)) {
        conditions.push(sql`lcsc = ${lcsc}`)
      }
    } else {
      const tokens = tokenizeSearchTerm(raw)
      const searchTokens = tokens.length > 0 ? tokens : [raw.toLowerCase()]
      const filteredTokens = searchTokens.filter((token) => token.length > 1)
      const likeTokens =
        filteredTokens.length > 0 ? filteredTokens : searchTokens

      for (const token of likeTokens) {
        const alternatives = Array.from(
          new Set(
            token.endsWith("mhz")
              ? [token, token.replace(/mhz$/, "m")]
              : [token],
          ),
        )

        const tokenConditions = alternatives.map(
          (alt) => sql`search_text LIKE ${`%${alt}%`}`,
        )

        conditions.push(sql`(${sql.join(tokenConditions, sql` OR `)})`)
      }
    }
  }

  const query = sql`
    SELECT
      lcsc,
      mfr,
      package,
      description,
      stock,
      price,
      price1,
      basic,
      preferred
    FROM search_index
    WHERE ${buildWhereClause(conditions)}
    ORDER BY stock DESC
    LIMIT ${limit}
  `

  const result = await query.execute(db)
  return result.rows as SearchRow[]
}
