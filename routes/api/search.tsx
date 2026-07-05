import { sql } from "kysely"
import {
  buildSearchTokenGroups,
  type SearchTokenGroup,
  tokenizeSearchTerm,
} from "lib/util/search-token-groups"
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

const ftsGroupQuery = (group: SearchTokenGroup): string => {
  const tokenQueries = group.map((token) => `${escapeFts5SearchTerm(token)}*`)
  return tokenQueries.length === 1
    ? tokenQueries[0]
    : `(${tokenQueries.join(" OR ")})`
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
    query = query.where("preferred", "=", 1).where("basic", "=", 0)
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
      const searchTokenGroups = buildSearchTokenGroups(searchTerm)
      const tokenGroupsForFtsRaw =
        searchTokenGroups.length > 0 ? searchTokenGroups : [[searchTerm]]
      const filteredFtsGroups = tokenGroupsForFtsRaw
        .map((group) => group.filter((token) => token.length > 1))
        .filter((group) => group.length > 0)
      const focusedFtsGroups = filteredFtsGroups.filter(
        (group) => !group.every((token) => broadSearchTokens.has(token)),
      )
      const qualifierFtsGroups = filteredFtsGroups.filter((group) =>
        group.every((token) => broadSearchTokens.has(token)),
      )
      const tokenQueries: string[] = []

      if (focusedFtsGroups.length > 0) {
        tokenQueries.push(...focusedFtsGroups.map(ftsGroupQuery))

        if (qualifierFtsGroups.length > 0) {
          tokenQueries.push(
            `(${qualifierFtsGroups.map(ftsGroupQuery).join(" OR ")})`,
          )
        }
      } else {
        tokenQueries.push(
          ...(filteredFtsGroups.length > 0
            ? filteredFtsGroups
            : tokenGroupsForFtsRaw
          ).map(ftsGroupQuery),
        )
      }

      const combinedFtsQuery = tokenQueries.join(" AND ")

      const tokenGroupsForLike =
        searchTokenGroups.length > 0 ? searchTokenGroups : [[searchTerm]]
      const filteredLikeGroups = tokenGroupsForLike
        .map((group) => group.filter((token) => token.length > 1))
        .filter((group) => group.length > 0)
      fallbackLikeTokens = (
        filteredLikeGroups.length > 0 ? filteredLikeGroups : tokenGroupsForLike
      ).map((group) => group.join("\0"))

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

    for (const groupValue of fallbackLikeTokens) {
      const group = groupValue.split("\0")
      const groupConditions = group.map((token) => {
        const pattern = `%${token}%`
        return sql<boolean>`(
          LOWER(COALESCE(mfr, '')) LIKE ${pattern}
          OR LOWER(COALESCE(description, '')) LIKE ${pattern}
          OR LOWER(COALESCE(extra, '')) LIKE ${pattern}
          OR LOWER(COALESCE(package, '')) LIKE ${pattern}
        )`
      })
      fallbackQuery = fallbackQuery.where(
        sql<boolean>`(${sql.join(groupConditions, sql` OR `)})`,
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
    is_extended_promotional: Boolean(c.preferred && !c.basic),
    description: c.description,
    stock: c.stock,
    price: extractSmallQuantityPrice(c.price),
  }))

  return ctx.json({
    components: req.query.full ? fullComponents : components,
  })
})
