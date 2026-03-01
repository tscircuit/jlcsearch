import { sql } from "kysely"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

const extractSmallQuantityPrice = (price: string | null): string => {
  if (!price) return ""
  try {
    const priceObj = JSON.parse(price)
    return priceObj[0]?.price || ""
  } catch {
    return ""
  }
}

/**
 * Builds a safe FTS5 query from a raw search term that may contain
 * special characters (e.g. "0.1uf", "10k-1%", "BC547B").
 *
 * FTS5 treats most punctuation as token separators, so "0.1uf" is
 * tokenized as ["0", "1uf"] by the unicode61 tokenizer.  Passing the
 * raw string directly — even inside double-quotes — can trigger a
 * "syntax error near '.'" in some SQLite builds.
 *
 * Strategy:
 *   1. Replace all non-alphanumeric characters with spaces.
 *   2. Split into individual tokens, discard empties.
 *   3. Build an AND-prefix FTS5 query: each token becomes `"token"*`.
 *   4. If no tokens survive, return null (caller should fall back to LIKE).
 */
const buildSafeFts5Query = (rawTerm: string): string | null => {
  const tokens = rawTerm
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) return null

  return tokens.map((t) => `"${t}"*`).join(" ")
}

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    full: z.boolean().optional(),
    q: z.string().optional(),
    limit: z.string().optional(),
    is_basic: z.boolean().optional(),
    is_preferred: z.boolean().optional(),
    is_extended_promotional: z.boolean().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  const limit = parseInt(req.query.limit ?? "100", 10) || 100

  let query = ctx.db
    .selectFrom("components")
    .selectAll()
    .limit(limit)
    .orderBy("stock", "desc")
    .where("stock", ">", 0)

  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  if (req.query.is_basic) {
    query = query.where("basic", "=", 1)
  }
  if (req.query.is_preferred) {
    query = query.where("preferred", "=", 1)
  }
  if (req.query.is_extended_promotional) {
    query = query.where("is_extended_promotional", "=", 1)
  }

  if (req.query.q) {
    const rawSearchTerm = req.query.q.trim()
    const searchTerm = rawSearchTerm.toLowerCase()

    if (/^c\d+$/i.test(rawSearchTerm)) {
      const lcscNumber = Number.parseInt(rawSearchTerm.slice(1), 10)

      if (!Number.isNaN(lcscNumber)) {
        query = query.where("lcsc", "=", lcscNumber)
      }
    } else {
      const safeFtsQuery = buildSafeFts5Query(searchTerm)

      if (safeFtsQuery) {
        // FTS5-safe path: use tokenised prefix query for speed
        const mfrFtsQuery = `mfr:(${safeFtsQuery})`
        const generalFtsQuery = safeFtsQuery
        const combinedFtsQuery = `${mfrFtsQuery} OR ${generalFtsQuery}`
        query = query.where(
          sql`lcsc`,
          "in",
          sql`(SELECT CAST(lcsc AS INTEGER) FROM components_fts WHERE components_fts MATCH ${combinedFtsQuery})`,
        )
      } else {
        // Fallback for terms that are all special characters: LIKE search
        const likePattern = `%${searchTerm}%`
        query = query.where((eb) =>
          eb.or([
            eb("mfr", "like", likePattern),
            eb("description", "like", likePattern),
          ]),
        )
      }
    }
  }

  const fullComponents = await query.execute()

  const components = fullComponents.map((c) => ({
    lcsc: c.lcsc,
    mfr: c.mfr,
    package: c.package,
    is_basic: Boolean(c.basic),
    is_preferred: Boolean(c.preferred),
    is_extended_promotional: Boolean(c.is_extended_promotional),
    description: c.description,
    stock: c.stock,
    price: extractSmallQuantityPrice(c.price),
  }))

  return ctx.json({
    components: req.query.full ? fullComponents : components,
  })
})
