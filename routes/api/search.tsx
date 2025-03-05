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
    `.execute(ctx.db).catch(console.warn),
  )



  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  if (req.query.q) {
    const searchTerm = req.query.q.trim().toLowerCase()
    const generalFtsQuery = `${searchTerm}*`
    const combinedFtsQuery = generalFtsQuery // FTS part for description/lcsc
    const searchPattern = `%${searchTerm}%`

    console.log("FTS Query:", combinedFtsQuery)

    const ftsResults = await sql`
      SELECT lcsc
      FROM components_fts
      WHERE components_fts MATCH ?
        OR mfr LIKE ?
      ORDER BY CASE WHEN mfr LIKE ? THEN 0 ELSE 1 END, rank
    `.execute(ctx.db)
    console.log("FTS Results:", ftsResults.rows)

    query = query.where(
      sql<boolean>`lcsc IN (
        SELECT lcsc
        FROM components_fts
        WHERE components_fts MATCH ?
          OR mfr LIKE ?
        ORDER BY CASE WHEN mfr LIKE ? THEN 0 ELSE 1 END, rank
      )`,
    )
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