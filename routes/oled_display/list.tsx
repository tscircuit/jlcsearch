import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
    protocol: z.string().optional(),
  }),
  jsonResponse: z.object({
    oled_displays: z.array(
      z.object({
        lcsc: z.number(),
        mfr: z.string(),
        package: z.string(),
        description: z.string(),
        stock: z.number(),
        price1: z.number(),
        protocol: z.string().optional(),
      }),
    ),
  }),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  const limit = 100

  const search = "OLED Display"
  const searchPattern = `%${search}%`

  let query = ctx.db
    .selectFrom("oled_display")
    .select([
      "lcsc",
      "mfr",
      "package",
      "description",
      "stock",
      "price1",
      "protocol",
    ] as const)
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

  if (params.protocol) {
    query = query.where("protocol", "=", params.protocol)
  }

  const fullComponents = await query.execute()

  const components = fullComponents.map((c) => ({
    lcsc: c.lcsc,
    mfr: c.mfr,
    package: c.package,
    description: c.description,
    stock: c.stock,
    price: c.price1,
    protocol: c.protocol,
  }))

  if (ctx.isApiRequest) {
    return ctx.json({
      oled_displays: fullComponents
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          package: c.package ?? "",
          description: c.description ?? "",
          stock: c.stock ?? 0,
          price1: c.price1 ?? 0,
          protocol: c.protocol ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0 && c.package !== ""),
    })
  }

  const protocols = await ctx.db
    .selectFrom("oled_display")
    .select("protocol")
    .distinct()
    .orderBy("protocol")
    .execute()

  const packages = await ctx.db
    .selectFrom("oled_display")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  return ctx.react(
    <div>
      <h2>OLED Displays</h2>

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

        <div>
          <label>Protocol:</label>
          <select name="protocol">
            <option value="">All</option>
            {protocols.map((p) => (
              <option
                key={p.protocol}
                value={p.protocol ?? ""}
                selected={p.protocol === params.protocol}
              >
                {p.protocol}
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
          protocol: c.protocol ?? "N/A",
        }))}
      />
    </div>,
  )
})
