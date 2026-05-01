import { sql, type Kysely, type RawBuilder } from "kysely"
import type { DB } from "./db/types"

export interface SearchQueryParams {
  q?: string
  package?: string
  subcategory_name?: string
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
  category: string | null
  subcategory: string | null
}

const tokenizeSearchTerm = (term: string): string[] =>
  term.toLowerCase().match(/[a-z0-9]+/g) ?? []

const buildWhereClause = (conditions: RawBuilder<unknown>[]) =>
  conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1 = 1`

const canFallbackToLikeSearch = (error: unknown): boolean =>
  error instanceof Error &&
  /no such table: search_index_fts/i.test(error.message)

const isMissingFtsReadinessTable = (error: unknown): boolean =>
  error instanceof Error &&
  /no such table: search_index_fts_meta/i.test(error.message)

async function isFtsSearchReady(db: Kysely<DB>): Promise<boolean> {
  try {
    const result = await sql`
      SELECT value
      FROM search_index_fts_meta
      WHERE key = 'ready'
      LIMIT 1
    `.execute(db)

    return (result.rows[0] as { value?: string } | undefined)?.value === "1"
  } catch (error) {
    if (isMissingFtsReadinessTable(error)) return false
    throw error
  }
}

const buildTokenConditions = (
  tokens: string[],
  column: RawBuilder<unknown>,
): RawBuilder<unknown>[] =>
  tokens.map((token) => {
    const alternatives = Array.from(
      new Set(
        token.endsWith("mhz") ? [token, token.replace(/mhz$/, "m")] : [token],
      ),
    )

    const tokenConditions = alternatives.map(
      (alt) => sql`${column} LIKE ${`%${alt}%`}`,
    )

    return sql`(${sql.join(tokenConditions, sql` OR `)})`
  })

export const getSearchTokens = (raw: string): string[] => {
  const tokens = tokenizeSearchTerm(raw)
  const searchTokens = tokens.length > 0 ? tokens : [raw.toLowerCase()]
  const filteredTokens = searchTokens.filter((token) => token.length > 1)
  return filteredTokens.length > 0 ? filteredTokens : searchTokens
}

export async function searchIndex(
  db: Kysely<DB>,
  params: SearchQueryParams,
): Promise<SearchRow[]> {
  const limit = Number.parseInt(params.limit ?? "100", 10) || 100
  const conditions: RawBuilder<unknown>[] = [sql`search_index.stock > 0`]
  const fallbackSearchConditions: RawBuilder<unknown>[] = []
  const ftsSearchConditions: RawBuilder<unknown>[] = []

  if (params.package) {
    conditions.push(sql`search_index.package = ${params.package}`)
  }

  if (params.subcategory_name) {
    conditions.push(sql`search_index.subcategory = ${params.subcategory_name}`)
  }

  if (params.is_basic === "true" || params.is_basic === "1") {
    conditions.push(sql`search_index.basic = 1`)
  }

  if (params.is_preferred === "true" || params.is_preferred === "1") {
    conditions.push(sql`search_index.preferred = 1`)
  }

  const raw = params.q?.trim()

  if (raw) {
    if (/^c?\d+$/i.test(raw)) {
      const normalized = raw.toLowerCase().startsWith("c") ? raw.slice(1) : raw
      const lcsc = Number.parseInt(normalized, 10)
      if (!Number.isNaN(lcsc)) {
        conditions.push(sql`search_index.lcsc = ${lcsc}`)
      }
    } else {
      const likeTokens = getSearchTokens(raw)
      fallbackSearchConditions.push(
        ...buildTokenConditions(likeTokens, sql`search_index.search_text`),
      )
      ftsSearchConditions.push(
        ...buildTokenConditions(likeTokens, sql`search_index_fts.search_text`),
      )
    }
  }

  const searchConditions =
    ftsSearchConditions.length > 0
      ? ftsSearchConditions
      : fallbackSearchConditions
  const selectSql = sql`
    SELECT
      search_index.lcsc,
      search_index.mfr,
      search_index.package,
      search_index.description,
      search_index.stock,
      search_index.price,
      search_index.price1,
      search_index.basic,
      search_index.preferred,
      search_index.category,
      search_index.subcategory
    FROM search_index
  `
  const orderLimitSql = sql`
    ORDER BY search_index.stock DESC
    LIMIT ${limit}
  `

  if (ftsSearchConditions.length > 0 && (await isFtsSearchReady(db))) {
    const ftsQuery = sql`
      ${selectSql}
      JOIN search_index_fts ON search_index_fts.rowid = search_index.rowid
      WHERE ${buildWhereClause([...conditions, ...searchConditions])}
      ${orderLimitSql}
    `

    try {
      const result = await ftsQuery.execute(db)
      return result.rows as SearchRow[]
    } catch (error) {
      if (!canFallbackToLikeSearch(error)) throw error
    }
  }

  const fallbackQuery = sql`
    ${selectSql}
    WHERE ${buildWhereClause([...conditions, ...fallbackSearchConditions])}
    ${orderLimitSql}
  `

  const result = await fallbackQuery.execute(db)
  return result.rows as SearchRow[]
}
