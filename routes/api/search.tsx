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

  console.log(
    77,
    await sql`
    SELECT mfr
    FROM components_fts;
  `
      .execute(ctx.db)
      .catch(console.warn),
  )

  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  if (req.query.q) {
    const searchTerm = req.query.q.trim().toLowerCase()

    // Specific mfr query with exact substring match
    const mfrFtsQuery = `mfr:${searchTerm}*`

    // General query for other fields
    const generalFtsQuery = `${searchTerm}*`

    // Prioritize mfr matches by listing first
    const combinedFtsQuery = `${mfrFtsQuery} OR ${generalFtsQuery}`

    // Log the FTS query for debugging
    console.log("FTS Query:", combinedFtsQuery)

    // Get matching lcsc values from FTS for debugging
    const ftsResults = await sql`
      SELECT CAST(lcsc AS INTEGER) AS lcsc
      FROM components_fts
      WHERE components_fts MATCH ${combinedFtsQuery}
      ORDER BY rank
    `.execute(ctx.db)
    console.log("FTS Results:", ftsResults.rows)

    query = query.where(
      sql<boolean>`lcsc IN (
        SELECT CAST(lcsc AS INTEGER)
        FROM components_fts
        WHERE components_fts MATCH ${combinedFtsQuery}
        ORDER BY rank
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
