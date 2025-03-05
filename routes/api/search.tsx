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

  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  if (req.query.q) {
    const searchTerm = req.query.q.trim().toLowerCase()

    // Specific mfr query with exact substring match
    const mfrFtsQuery = `mfr:"${searchTerm}" OR mfr:${searchTerm}*`

    // General query for other fields
    const generalFtsQuery = `${searchTerm}*`

    // Prioritize mfr matches with AND fallback to general
    const combinedFtsQuery = `${mfrFtsQuery} OR ${generalFtsQuery}`

    console.log("FTS Query:", combinedFtsQuery);

    const ftsResults = await sql`
      SELECT CAST(lcsc AS INTEGER) AS lcsc
      FROM components_fts
      WHERE components_fts MATCH ${combinedFtsQuery}
      ORDER BY CASE WHEN mfr LIKE '%${searchTerm}%' THEN 0 ELSE 1 END, rank
    `.execute(ctx.db);
    console.log("FTS Results:", ftsResults.rows);

    query = query.where(
      sql<boolean>`lcsc IN (
        SELECT CAST(lcsc AS INTEGER)
        FROM components_fts
        WHERE components_fts MATCH ${combinedFtsQuery}
        ORDER BY CASE WHEN mfr LIKE '%${searchTerm}%' THEN 0 ELSE 1 END, rank
      )`,
    )
  }

  const fullComponents= await query.execute()

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