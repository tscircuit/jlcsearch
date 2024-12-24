import { sql } from "kysely"
import { Table } from "lib/ui/Table"
import { ExpressionBuilder } from "kysely"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

const extractSmallQuantityPrice = (price: string | null) => {
  try {
    const priceObj = JSON.parse(price!)
    return priceObj[0].price
  } catch (e) {
    return ""
  }
}

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    subcategory_name: z.string().optional(),
    full: z.boolean().optional(),
    search: z.string().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  const limit = 100

  let query = ctx.db
    .selectFrom("v_components")
    .select([
      "lcsc",
      "mfr",
      "package",
      "description",
      "stock",
      "price",
      "extra",
    ])
    .limit(limit)
    .orderBy("stock", "desc")
    .where("stock", ">", 0)

  if (req.query.subcategory_name) {
    query = query.where("subcategory", "=", req.query.subcategory_name)
  }

  if (req.query.search) {
    const search = req.query.search // TypeScript now knows this is defined within this block
    const searchPattern = `%${search}%`
    query = query.where((eb) =>
      eb("description", "like", searchPattern)
        .or("mfr", "like", searchPattern)
        // For lcsc, we'll search it as a number if it's numeric, otherwise skip it
        .or(
          search.match(/^\d+$/)
            ? eb("lcsc", "=", parseInt(search))
            : eb("description", "like", searchPattern), // Fallback to description if not numeric
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

  if (ctx.isApiRequest) {
    return ctx.json({
      components: req.query.full ? fullComponents : components,
    })
  }

  return ctx.react(
    <div>
      <h2>Components</h2>
      {req.query.subcategory_name && (
        <div>Filtering by subcategory: {req.query.subcategory_name}</div>
      )}
      <Table rows={req.query.full ? fullComponents : components} />
    </div>,
  )
})
