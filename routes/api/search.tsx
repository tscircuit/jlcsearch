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

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    full: z.boolean().optional(),
    q: z.string().optional(),
    limit: z.string().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  try {
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

    if (req.query.q) {
      const searchTerm = req.query.q.trim().toLowerCase()
      const searchPattern = `%${searchTerm}%`

      // Full-text search query for mfr and other fields
      const mfrFtsQuery = `mfr:${searchTerm}*`
      const generalFtsQuery = `${searchTerm}*`
      const combinedFtsQuery = `${mfrFtsQuery} OR ${generalFtsQuery}`
      query = query.where((eb) =>
        eb("mfr", "like", searchPattern)
          .or("description", "like", searchPattern)
          .or(sql<boolean>`CAST(lcsc AS TEXT) LIKE ${searchPattern}`)
          .or(sql<boolean>`lcsc IN (
            SELECT CAST(lcsc AS INTEGER)
            FROM components_fts
            WHERE components_fts MATCH ${combinedFtsQuery}
            ORDER BY rank
          )`)
      )
    }

    const fullComponents = await query.execute()

    const components = fullComponents.map((c) => {
      const tierVal = c?.tier ?? c?.jlcpcb_tier ?? ""
      const tier = typeof tierVal === "string" ? tierVal.toLowerCase().trim() : ""
      const isBasic =
        tier === "basic" ||
        c?.basic === 1 ||
        c?.basic === true ||
        c?.basic === 1 ||
        c?.is_basic === true

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        package: c.package,
        description: c.description,
        stock: c.stock,
        price: extractSmallQuantityPrice(c.price),
        isBasic,
      }
    })

    return ctx.json({
      components: req.query.full ? fullComponents : components,
    })
  } catch (err) {
    console.error("Search route error:", err)
    return ctx.json({ ok: false, error: String(err) })
  }
})
