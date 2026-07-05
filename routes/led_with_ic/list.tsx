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
      }),
    ),
  }),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  const limit = 100

  let query = ctx.db
    .selectFrom("led_with_ic")
    .innerJoin("components", "led_with_ic.lcsc", "components.lcsc")
    .innerJoin("categories", "components.category_id", "categories.id")
    .select([
      "led_with_ic.lcsc",
      "led_with_ic.mfr",
      "led_with_ic.package",
      "led_with_ic.description",
      "led_with_ic.stock",
      "led_with_ic.price1",
      "led_with_ic.color",
      "led_with_ic.protocol",
      "led_with_ic.forward_voltage",
      "led_with_ic.forward_current",
    ] as const)
    .limit(limit)
    .orderBy("led_with_ic.stock", "desc")
    .where("categories.subcategory", "=", "RGB LEDs(Built-In IC)")
    .where("led_with_ic.stock", ">", 0)

  if (params.package) {
    query = query.where("led_with_ic.package", "=", params.package)
  }

  if (params.color) {
    query = query.where("led_with_ic.color", "=", params.color)
  }

  if (params.protocol) {
    query = query.where("led_with_ic.protocol", "=", params.protocol)
  }

  const fullComponents = await query.execute()

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
          protocol: c.protocol ?? "",
          forward_voltage: c.forward_voltage ?? undefined,
          forward_current: c.forward_current ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0 && c.package !== ""),
    })
  }

  const packages = await ctx.db
    .selectFrom("led_with_ic")
    .innerJoin("components", "led_with_ic.lcsc", "components.lcsc")
    .innerJoin("categories", "components.category_id", "categories.id")
    .select("led_with_ic.package")
    .distinct()
    .where("categories.subcategory", "=", "RGB LEDs(Built-In IC)")
    .orderBy("led_with_ic.package")
    .execute()

  const colors = await ctx.db
    .selectFrom("led_with_ic")
    .innerJoin("components", "led_with_ic.lcsc", "components.lcsc")
    .innerJoin("categories", "components.category_id", "categories.id")
    .select("led_with_ic.color")
    .distinct()
    .where("categories.subcategory", "=", "RGB LEDs(Built-In IC)")
    .orderBy("led_with_ic.color")
    .execute()

  const protocols = await ctx.db
    .selectFrom("led_with_ic")
    .innerJoin("components", "led_with_ic.lcsc", "components.lcsc")
    .innerJoin("categories", "components.category_id", "categories.id")
    .select("led_with_ic.protocol")
    .distinct()
    .where("categories.subcategory", "=", "RGB LEDs(Built-In IC)")
    .orderBy("led_with_ic.protocol")
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
