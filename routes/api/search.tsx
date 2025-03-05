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
    q: z.string().optional(), // Keeping 'q' as the parameter name per your tests
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
    const search = req.query.q.trim().toLowerCase()
    const searchPattern = `%${search}%`

    query = query.where((eb) =>
      eb("mfr", "like", searchPattern) // Prioritize mfr matches
        .or("description", "like", searchPattern)
        .or(
          search.match(/^\d+$/)
            ? eb("lcsc", "=", parseInt(search))
            : eb("description", "like", searchPattern), // Fallback if lcsc isn't numeric
        ),
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
