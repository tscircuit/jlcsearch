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
    capacity: z.string().optional(),
    voltage: z.string().optional(),
    chemistry: z.string().optional(),
    mfr: z.string().optional(),
    description: z.string().optional(),
  }),
  jsonResponse: z.object({
    batteries: z.array(
      z.object({
        lcsc: z.number(),
        mfr: z.string(),
        package: z.string(),
        description: z.string(),
        stock: z.number(),
        price1: z.number(),
        capacity: z.number(),
        voltage: z.number(),
        chemistry: z.string(),
        is_rechargeable: z.boolean(),
      }),
    ),
  }),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  const limit = 100
  const search = "battery"
  const searchPattern = `%${search}%`

  let query = ctx.db
    .selectFrom("battery")
    .select([
      "lcsc",
      "mfr",
      "package",
      "description",
      "stock",
      "price1",
      "capacity",
      "voltage",
      "chemistry",
      "is_rechargeable",
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

  // Add filters for each column
  if (params.package) {
    query = query.where("package", "=", params.package)
  }
  if (params.capacity) {
    query = query.where("capacity", "=", parseFloat(params.capacity))
  }
  if (params.voltage) {
    query = query.where("voltage", "=", parseFloat(params.voltage))
  }
  if (params.chemistry) {
    query = query.where("chemistry", "=", params.chemistry)
  }
  if (params.mfr) {
    query = query.where("mfr", "like", `%${params.mfr}%`)
  }
  if (params.description) {
    query = query.where("description", "like", `%${params.description}%`)
  }

  const fullComponents = await query.execute()
  const components = fullComponents.map((c) => ({
    lcsc: c.lcsc,
    mfr: c.mfr,
    package: c.package,
    description: c.description,
    stock: c.stock,
    price: c.price1,
    capacity: c.capacity,
    voltage: c.voltage,
    chemistry: c.chemistry,
    is_rechargeable: Boolean(c.is_rechargeable),
  }))

  if (ctx.isApiRequest) {
    return ctx.json({
      batteries: fullComponents
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          package: c.package ?? "",
          description: c.description ?? "",
          stock: c.stock ?? 0,
          price1: c.price1 ?? 0,
          capacity: c.capacity ?? 0,
          voltage: c.voltage ?? 0,
          chemistry: c.chemistry ?? "",
          is_rechargeable: Boolean(c.is_rechargeable),
        }))
        .filter((c) => c.lcsc !== 0 && c.package !== ""),
    })
  }

  const packages = await ctx.db
    .selectFrom("battery")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  const chemistries = await ctx.db
    .selectFrom("battery")
    .select("chemistry")
    .distinct()
    .orderBy("chemistry")
    .execute()

  return ctx.react(
    <div>
      <h2>Batteries</h2>
      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Package: </label>
          <select name="package" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {packages.map((p) => (
              <option
                key={p.package}
                value={p.package ?? ""}
                selected={p.package === params.package}
              >
                {p.package || "-"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Chemistry: </label>
          <select name="chemistry" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {chemistries.map((c) => (
              <option
                key={c.chemistry}
                value={c.chemistry ?? ""}
                selected={c.chemistry === params.chemistry}
              >
                {c.chemistry || "-"}
              </option>
            ))}
          </select>
        </div>
      </form>
      <Table rows={components} timezone="UTC" />
    </div>,
  )
})
