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

const escapeFts5SearchTerm = (term: string): string => {
  return `"${term.replace(/"/g, '""')}"`
}

const tokenizeSearchTerm = (term: string): string[] => {
  return term.toLowerCase().match(/[a-z0-9]+/g) ?? []
}

const broadSearchTokens = new Set([
  "usb",
  "type",
  "connector",
  "resistor",
  "capacitor",
  "inductor",
  "surface",
  "mount",
  "chip",
])

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

  const baseQuery = query
  let fallbackLikeTokens: string[] = []
  let fallbackPackageTokens: string[] = []

  if (req.query.q) {
    const rawSearchTerm = req.query.q.trim()
    const searchTerm = rawSearchTerm.toLowerCase()

    if (/^c\d+$/i.test(rawSearchTerm)) {
      const lcscNumber = Number.parseInt(rawSearchTerm.slice(1), 10)

      if (!Number.isNaN(lcscNumber)) {
        query = query.where("lcsc", "=", lcscNumber)
      }
    } else {
      const searchTokens = tokenizeSearchTerm(searchTerm)
      const tokensForFtsRaw =
        searchTokens.length > 0 ? searchTokens : [searchTerm]
      const filteredFtsTokens = tokensForFtsRaw.filter(
        (token) => token.length > 1,
      )
      const focusedFtsTokens = filteredFtsTokens.filter(
        (token) => !broadSearchTokens.has(token),
      )
      const qualifierFtsTokens = filteredFtsTokens.filter((token) =>
        broadSearchTokens.has(token),
      )
      const tokenQueries: string[] = []

      if (focusedFtsTokens.length > 0) {
        tokenQueries.push(
          ...focusedFtsTokens.map((token) => {
            const quotedToken = escapeFts5SearchTerm(token)
            return `${quotedToken}*`
          }),
        )

        if (qualifierFtsTokens.length > 0) {
          tokenQueries.push(
            `(${qualifierFtsTokens
              .map((token) => `${escapeFts5SearchTerm(token)}*`)
              .join(" OR ")})`,
          )
        }
      } else {
        tokenQueries.push(
          ...(filteredFtsTokens.length > 0
            ? filteredFtsTokens
            : tokensForFtsRaw
          ).map((token) => {
            const quotedToken = escapeFts5SearchTerm(token)
            return `${quotedToken}*`
          }),
        )
      }

      const combinedFtsQuery = tokenQueries.join(" AND ")

      const tokensForLike =
        searchTokens.length > 0 ? searchTokens : [searchTerm]
      const filteredLikeTokens = tokensForLike.filter(
        (token) => token.length > 1,
      )
      fallbackLikeTokens =
        filteredLikeTokens.length > 0 ? filteredLikeTokens : tokensForLike

      query = query.where(
        sql`lcsc`,
        "in",
        sql`(SELECT CAST(lcsc AS INTEGER) FROM components_fts WHERE components_fts MATCH ${combinedFtsQuery})`,
      )

      const packageTokens = searchTokens.filter((token) =>
        /^\d{4}$/.test(token),
      )
      fallbackPackageTokens = packageTokens
      if (packageTokens.length > 0) {
        query = query.where("package", "in", packageTokens)
      }
    }
  }

  const fullComponents = await query.execute()

  if (fallbackLikeTokens.length > 0 && fullComponents.length === 0) {
    let fallbackQuery = baseQuery

    if (fallbackPackageTokens.length > 0) {
      fallbackQuery = fallbackQuery.where(
        "package",
        "in",
        fallbackPackageTokens,
      )
    }

    for (const token of fallbackLikeTokens) {
      const pattern = `%${token}%`
      fallbackQuery = fallbackQuery.where(
        sql<boolean>`(
          LOWER(COALESCE(mfr, '')) LIKE ${pattern}
          OR LOWER(COALESCE(description, '')) LIKE ${pattern}
          OR LOWER(COALESCE(extra, '')) LIKE ${pattern}
          OR LOWER(COALESCE(package, '')) LIKE ${pattern}
        )`,
      )
    }

    const fallbackComponents = await fallbackQuery.execute()
    const seenLcsc = new Set(fullComponents.map((component) => component.lcsc))

    for (const component of fallbackComponents) {
      if (seenLcsc.has(component.lcsc)) continue
      fullComponents.push(component)
      seenLcsc.add(component.lcsc)
      if (fullComponents.length >= limit) break
    }
  }

  const components = fullComponents.map((c) => ({
    lcsc: c.lcsc,
    mfr: c.mfr,
    package: c.package,
    is_basic: Boolean(c.basic),
    is_preferred: Boolean(c.preferred),
    description: c.description,
    stock: c.stock,
    is_extended_promotional: Boolean(c.is_extended_promotional),
    price: extractSmallQuantityPrice(c.price),
  }))

  return ctx.json({
    components: req.query.full ? fullComponents : components,
  })
})
