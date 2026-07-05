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
    positions: z.string().optional(),
    type: z.string().optional(),
    size: z.string().optional(),
    color: z.string().optional(),
    mfr: z.string().optional(),
    description: z.string().optional(),
  }),
  jsonResponse: z.object({
    led_segment_displays: z.array(
      z.object({
        lcsc: z.number(),
        mfr: z.string(),
        package: z.string(),
        description: z.string(),
        stock: z.number(),
        price1: z.number(),
        positions: z.string().optional(),
        type: z.string().optional(),
        size: z.string().optional(),
        color: z.string().optional(),
      }),
    ),
  }),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  const limit = 100
  const search = "LED Segment Display"
  const searchPattern = `%${search}%`

  let query = ctx.db
    .selectFrom("led_segment_display")
    .select([
      "lcsc",
      "mfr",
      "package",
      "description",
      "stock",
      "price1",
      "positions",
      "type",
      "size",
      "color",
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
  if (params.positions) {
    query = query.where("positions", "=", params.positions)
  }
  if (params.type) {
    query = query.where("type", "=", params.type)
  }
  if (params.size) {
    query = query.where("size", "=", params.size)
  }
  if (params.color) {
    query = query.where("color", "=", params.color)
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
    positions: c.positions,
    type: c.type,
    size: c.size,
    color: c.color,
  }))

  if (ctx.isApiRequest) {
    return ctx.json({
      led_segment_displays: fullComponents
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          package: c.package ?? "",
          description: c.description ?? "",
          stock: c.stock ?? 0,
          price1: c.price1 ?? 0,
          positions: c.positions ?? undefined,
          type: c.type ?? undefined,
          size: c.size ?? undefined,
          color: c.color ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0 && c.package !== ""),
    })
  }

  const positions = await ctx.db
    .selectFrom("led_segment_display")
    .select("positions")
    .distinct()
    .orderBy("positions")
    .execute()

  const packages = await ctx.db
    .selectFrom("led_segment_display")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  const types = await ctx.db
    .selectFrom("led_segment_display")
    .select("type")
    .distinct()
    .orderBy("type")
    .execute()

  const sizes = await ctx.db
    .selectFrom("led_segment_display")
    .select("size")
    .distinct()
    .orderBy("size")
    .execute()

  const colors = await ctx.db
    .selectFrom("led_segment_display")
    .select("color")
    .distinct()
    .orderBy("color")
    .execute()

  return ctx.react(
    <div>
      <h2>LED Segment Displays</h2>
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
          <label>Positions: </label>
          <select name="positions" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {positions.map((p) => (
              <option
                key={p.positions}
                value={p.positions ?? ""}
                selected={p.positions === params.positions}
              >
                {p.positions || "N/A"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Type: </label>
          <select name="type" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {types.map((t) => (
              <option
                key={t.type}
                value={t.type ?? ""}
                selected={t.type === params.type}
              >
                {t.type || "N/A"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Size: </label>
          <select name="size" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {sizes.map((s) => (
              <option
                key={s.size}
                value={s.size ?? ""}
                selected={s.size === params.size}
              >
                {s.size || "N/A"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Color: </label>
          <select name="color" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {colors.map((c) => (
              <option
                key={c.color}
                value={c.color ?? ""}
                selected={c.color === params.color}
              >
                {c.color || "N/A"}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
        >
          Filter
        </button>
      </form>
      <Table
        rows={components.map((c) => ({
          lcsc: c.lcsc,
          mfr: c.mfr,
          package: c.package || "-",
          description: c.description,
          positions: c.positions ?? "N/A",
          type: c.type ?? "N/A",
          size: c.size ?? "N/A",
          color: c.color ?? "N/A",
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price)}</span>,
        }))}
      />
    </div>,
    "JLCPCB LED Segment Display Search",
  )
})
