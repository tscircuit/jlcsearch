import { sql } from "kysely"
import { Table } from "lib/ui/Table"
import { ExpressionBuilder } from "kysely"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import type { DB } from "lib/db/generated/kysely"
import { Kysely } from "kysely"
import { formatPrice } from "lib/util/format-price"

type KyselyDatabaseInstance = Kysely<DB>

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
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  const limit = 100

  // Hardcoding the search value to "LEDs(Built-in IC)"
  const search = "LEDs(Built-in IC)"
  const searchPattern = `%${search}%`

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
    .where((eb) =>
      eb("description", "like", searchPattern)
        .or("mfr", "like", searchPattern)
        .or(
          search.match(/^\d+$/)
            ? eb("lcsc", "=", parseInt(search))
            : eb("description", "like", searchPattern),
        ),
    )

  if (params.package) {
    query = query.where("package", "=", params.package)
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
      leds_with_ic: params.json ? fullComponents : components,
    })
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("v_components")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  return ctx.react(
    <div>
      <h2>LEDs with Built-in IC</h2>

      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Package:</label>
          <select name="package">
            <option value="">All</option>
            {packages.map((p) => (
              <option
                key={p.package}
                value={p.package ?? ""}
                selected={p.package === params.package}
              >
                {p.package}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={components.map((c) => ({
          lcsc: c.lcsc,
          mfr: c.mfr,
          package: c.package,
          description: c.description,
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price)}</span>,
        }))}
      />
    </div>,
  )
})
