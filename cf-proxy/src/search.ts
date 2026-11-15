import { sql, type Kysely, type RawBuilder } from "kysely"
import type { DB } from "./db/types"
import { buildSearchTokenGroups } from "./search-query"
import { exactLcsc } from "./requested-stock"

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

const buildWhereClause = (conditions: RawBuilder<unknown>[]) =>
  conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1 = 1`

export class SearchUnavailableError extends Error {
  constructor() {
    super(
      "Text search is temporarily unavailable. Please try again shortly or search by an exact LCSC part number.",
    )
    this.name = "SearchUnavailableError"
  }
}

export class InvalidSearchQueryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidSearchQueryError"
  }
}

const isMissingFtsSearchTable = (error: unknown): boolean =>
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
      WHERE key = 'ready_lcsc'
      LIMIT 1
    `.execute(db)

    return (result.rows[0] as { value?: string } | undefined)?.value === "1"
  } catch (error) {
    if (isMissingFtsReadinessTable(error)) return false
    throw error
  }
}

const getSearchTokenGroups = (raw: string): string[][] => {
  const tokenGroups = buildSearchTokenGroups(raw)
  const searchTokenGroups =
    tokenGroups.length > 0 ? tokenGroups : [[raw.toLowerCase()]]
  const filteredTokenGroups = searchTokenGroups
    .map((group) => group.filter((token) => token.length > 1))
    .filter((group) => group.length > 0)

  return filteredTokenGroups.length > 0
    ? filteredTokenGroups
    : searchTokenGroups
}

const tokenAlternatives = (group: string[]) =>
  Array.from(
    new Set(
      group.flatMap((token) =>
        token.endsWith("mhz") ? [token, token.replace(/mhz$/, "m")] : [token],
      ),
    ),
  )

export const validateSearchQuery = (params: SearchQueryParams) => {
  const raw = params.q?.trim() ?? ""
  // SQLite's FTS parser treats NUL as a terminator, even inside a quoted phrase.
  if (raw.includes("\0")) {
    throw new InvalidSearchQueryError(
      "Search text must not contain NUL characters.",
    )
  }
  const limit = params.limit === undefined ? 100 : Number(params.limit)
  if (
    (params.limit !== undefined && !/^\d+$/.test(params.limit)) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 1000
  ) {
    throw new InvalidSearchQueryError(
      "Limit must be a whole number from 1 to 1000.",
    )
  }
  if (raw.length > 256) {
    throw new InvalidSearchQueryError(
      "Search text must be 256 characters or fewer.",
    )
  }
  const tokenGroups =
    raw && !/^c?\d+$/i.test(raw) ? getSearchTokenGroups(raw) : []
  // An OR group is safe to use for candidates only if every alternative is
  // indexable. Short terms (e.g. DC or 8M) are still checked against the source.
  const indexedGroups = tokenGroups
    .map(tokenAlternatives)
    .filter((group) =>
      group.every(
        (token) => Array.from(token).length >= 3 && !/[%_]/.test(token),
      ),
    )
  if (tokenGroups.length && !indexedGroups.length) {
    throw new InvalidSearchQueryError(
      'Add another search term, such as "dc connector", "IC amplifier", or "8MHz crystal", or use an exact LCSC part number.',
    )
  }
  const match = indexedGroups
    .map(
      (group) =>
        `(${group.map((token) => `"${token.replaceAll('"', '""')}"`).join(" OR ")})`,
    )
    .join(" AND ")
  return { raw, limit, tokenGroups, match }
}

const buildTokenGroupConditions = (
  tokenGroups: string[][],
  column: RawBuilder<unknown>,
): RawBuilder<unknown>[] =>
  tokenGroups.map((group) => {
    const alternatives = tokenAlternatives(group)

    const tokenConditions = alternatives.map(
      (alt) => sql`${column} LIKE ${`%${alt}%`}`,
    )

    return sql`(${sql.join(tokenConditions, sql` OR `)})`
  })

export async function searchIndex(
  db: Kysely<DB>,
  params: SearchQueryParams,
): Promise<SearchRow[]> {
  const { raw, limit, tokenGroups, match } = validateSearchQuery(params)
  const conditions: RawBuilder<unknown>[] =
    exactLcsc(params.q) !== null ? [] : [sql`search_index.stock > 0`]
  const textSearchConditions: RawBuilder<unknown>[] = []

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

  if (raw) {
    if (/^c?\d+$/i.test(raw)) {
      const normalized = raw.toLowerCase().startsWith("c") ? raw.slice(1) : raw
      const lcsc = Number.parseInt(normalized, 10)
      if (!Number.isNaN(lcsc)) {
        conditions.push(sql`search_index.lcsc = ${lcsc}`)
      }
    } else {
      textSearchConditions.push(
        ...buildTokenGroupConditions(
          tokenGroups,
          sql`search_index.search_text`,
        ),
      )
    }
  }

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

  if (match) {
    // Scanning the catalog while FTS is unavailable competes with its rebuild.
    // Cache hits are served before this function; exact LCSC lookups skip FTS.
    if (!(await isFtsSearchReady(db))) throw new SearchUnavailableError()

    const ftsQuery = sql`
      ${selectSql}
      JOIN search_index_fts ON search_index_fts.rowid = search_index.lcsc
      WHERE search_index_fts MATCH ${match}
        AND ${buildWhereClause([...conditions, ...textSearchConditions])}
      ${orderLimitSql}
    `

    try {
      const result = await ftsQuery.execute(db)
      return result.rows as SearchRow[]
    } catch (error) {
      if (isMissingFtsSearchTable(error)) throw new SearchUnavailableError()
      throw error
    }
  }

  const query = sql`
    ${selectSql}
    WHERE ${buildWhereClause(conditions)}
    ${orderLimitSql}
  `

  const result = await query.execute(db)
  return result.rows as SearchRow[]
}
