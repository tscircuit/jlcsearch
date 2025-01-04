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
    color: z.string().optional(),
    protocol: z.string().optional(),
  }),
  jsonResponse: z.object({
    leds_with_ic: z.array(
      z.object({
        lcsc: z.number(),
        mfr: z.string(),
        package: z.string(),
        description: z.string(),
        stock: z.number(),
        price1: z.number(),
        color: z.string().optional(),
        protocol: z.string().optional(),
        forward_voltage: z.number().optional(),
        forward_current: z.number().optional(),
      })
    ),
  }),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  const limit = 100

  // Hardcoding the search value to "LEDs(Built-in IC)"
  const search = "LEDs(Built-in IC)"
  const searchPattern = `%${search}%`

  let query = ctx.db
    .selectFrom("led_with_ic")
    .select([
      "lcsc",
      "mfr",
      "package",
      "description",
      "stock",
      "price1",
      "color",
      "protocol",
      "forward_voltage",
      "forward_current",
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

  if (params.color) {
    query = query.where("color", "=", params.color)
  }

  if (params.protocol) {
    query = query.where("protocol", "=", params.protocol)
  }

  const fullComponents = await query.execute()

  // Log the results to verify the data
  console.log(fullComponents)

  const components = fullComponents.map((c) => ({
    lcsc: c.lcsc,
    mfr: c.mfr,
    package: c.package,
    description: c.description,
    stock: c.stock,
    price: c.price1,
    forward_voltage: c.forward_voltage ?? undefined,
    forward_current: c.forward_current ?? undefined,
    color: c.color,
    protocol: c.protocol,
    power_consumption:
      c.forward_voltage && c.forward_current
        ? `${c.forward_voltage * c.forward_current} mW`
        : "N/A",
  }))

  if (ctx.isApiRequest) {
    return ctx.json({
      leds_with_ic: fullComponents
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          package: c.package ?? "",
          description: c.description ?? "",
          stock: c.stock ?? 0,
          price1: c.price1 ?? 0,
          color: c.color ?? undefined,
          protocol: c.protocol ?? undefined,
          forward_voltage: c.forward_voltage ?? undefined,
          forward_current: c.forward_current ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0 && c.package !== ""),
    })
  }

  const packages = await ctx.db
    .selectFrom("led_with_ic")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  const colors = await ctx.db
    .selectFrom("led_with_ic")
    .select("color")
    .distinct()
    .orderBy("color")
    .execute()

  const protocols = await ctx.db
    .selectFrom("led_with_ic")
    .select("protocol")
    .distinct()
    .orderBy("protocol")
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

        <div>
          <label>Color:</label>
          <select name="color">
            <option value="">All</option>
            {colors.map((c) => (
              <option
                key={c.color}
                value={c.color ?? ""}
                selected={c.color === params.color}
              >
                {c.color}
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
          color: c.color,
          protocol: c.protocol,
          forward_voltage: c.forward_voltage ? `${c.forward_voltage}V` : "",
          forward_current: c.forward_current ? `${c.forward_current}A` : "",
          power_consumption: c.power_consumption,
        }))}
      />
    </div>,
  )
})
