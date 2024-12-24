import { sql } from "kysely"
import { Table } from "lib/ui/Table"
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

  if (req.query.search) {
    const searchTerm = `%${req.query.search}%`
    query = query.where((eb) => eb.or([
      sql<boolean>`LOWER(COALESCE(description, '')) LIKE ${sql.raw(`LOWER(${searchTerm})`)}`,
      sql<boolean>`LOWER(COALESCE(mfr, '')) LIKE ${sql.raw(`LOWER(${searchTerm})`)}`,
      sql<boolean>`LOWER(COALESCE(package, '')) LIKE ${sql.raw(`LOWER(${searchTerm})`)}`,
      sql<boolean>`COALESCE(CAST(lcsc AS TEXT), '') LIKE ${searchTerm}`
    ]))
  }

  if (req.query.subcategory_name) {
    query = query.where("subcategory", "=", req.query.subcategory_name)
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
