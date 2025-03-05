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
  const limit = parseInt(req.query.limit ?? "100", 10) || 100

  let query = ctx.db
    .selectFrom("components")
    .selectAll()
    .limit(limit)
    .orderBy("stock", "desc")
    .where("stock", ">", 0)

  console.log(
    69,
    await sql`
      SELECT *
      FROM components_fts
      WHERE mfr LIKE '%c1234%';
    `
      .execute(ctx.db)
      .catch(console.warn),
  )

  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  if (req.query.q) {
    const searchTerm = req.query.q.trim().toLowerCase()

    // Use mfr directly with LIKE since FTS isn't matching substrings
    const ftsResults = await sql`
      SELECT lcsc
      FROM components_fts
      WHERE mfr LIKE '%${searchTerm}%'
    `.execute(ctx.db)
    console.log("FTS Results (LIKE):", ftsResults.rows, searchTerm)

    if (ftsResults.rows.length > 0) {
      query = query.where(
        sql<boolean>`lcsc IN (
          SELECT lcsc
          FROM components_fts
          WHERE mfr LIKE '%${searchTerm}%'
        )`,
      )
    } else {
      // Fallback to general FTS search
      const generalFtsQuery = `${searchTerm}*`
      console.log("Fallback FTS Query:", generalFtsQuery)
      const fallbackResults = await sql`
        SELECT lcsc
        FROM components_fts
        WHERE components_fts MATCH ${generalFtsQuery}
        ORDER BY rank
      `.execute(ctx.db)
      console.log("Fallback FTS Results:", fallbackResults.rows)
      query = query.where(
        sql<boolean>`lcsc IN (
          SELECT lcsc
          FROM components_fts
          WHERE components_fts MATCH ${generalFtsQuery}
          ORDER BY rank
        )`,
      )
    }
  }

  const fullComponents = await query.execute()

  const components = fullComponents.map((c) => ({
    lcsc: c.lcsc,
    mfr: c.mfr,
    package: c.package,
    description: c.description,
    stock: c.stock,
    price: extractSmallQuantityPrice(c.price),
  }))

  return ctx.json({
    components: req.query.full ? fullComponents : components,
  })
})
