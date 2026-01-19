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

  if (req.query.q) {
    const rawSearchTerm = req.query.q.trim()
    const searchTerm = rawSearchTerm.toLowerCase()

    if (/^c\d+$/i.test(rawSearchTerm)) {
      const lcscNumber = Number.parseInt(rawSearchTerm.slice(1), 10)

      if (!Number.isNaN(lcscNumber)) {
        query = query.where("lcsc", "=", lcscNumber)
      }
    } else {
      const quotedTerm = escapeFts5SearchTerm(searchTerm)
      const mfrFtsQuery = `mfr:${quotedTerm}`
      const generalFtsQuery = quotedTerm
      const combinedFtsQuery = `${mfrFtsQuery} OR ${generalFtsQuery}`
      query = query.where(
        sql`lcsc`,
        "in",
        sql`(SELECT CAST(lcsc AS INTEGER) FROM components_fts WHERE components_fts MATCH ${combinedFtsQuery})`,
      )
    }
  }

  const fullComponents = await query.execute()

  const components = fullComponents.map((c) => ({
    lcsc: c.lcsc,
    mfr: c.mfr,
    package: c.package,
    is_basic: Boolean(c.basic),
    is_preferred: Boolean(c.preferred),
    description: c.description,
    stock: c.stock,
    price: extractSmallQuantityPrice(c.price),
  }))

  return ctx.json({
    components: req.query.full ? fullComponents : components,
  })
})
