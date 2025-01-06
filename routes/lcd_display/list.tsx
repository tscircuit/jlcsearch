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
    display_size: z.string().optional(),
    resolution: z.string().optional(),
    display_type: z.string().optional(),
    mfr: z.string().optional(),
    description: z.string().optional(),
  }),
  jsonResponse: z.object({
    lcd_displays: z.array(
      z.object({
        lcsc: z.number(),
        mfr: z.string(),
        package: z.string(),
        description: z.string(),
        stock: z.number(),
        price1: z.number(),
        display_size: z.string().optional(),
        resolution: z.string().optional(),
        display_type: z.string().optional(),
      }),
    ),
  }),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  const limit = 100
  const search = "LCD"
  const searchPattern = `%${search}%`

  let query = ctx.db
    .selectFrom("lcd_display")
    .select([
      "lcsc",
      "mfr",
      "package",
      "description",
      "stock",
      "price1",
      "display_size",
      "resolution",
      "display_type",
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
  if (params.display_size) {
    query = query.where("display_size", "=", params.display_size)
  }
  if (params.resolution) {
    query = query.where("resolution", "=", params.resolution)
  }
  if (params.display_type) {
    query = query.where("display_type", "=", params.display_type)
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
    display_size: c.display_size,
    resolution: c.resolution,
    display_type: c.display_type,
  }))

  if (ctx.isApiRequest) {
    return ctx.json({
      lcd_displays: fullComponents
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          package: c.package ?? "",
          description: c.description ?? "",
          stock: c.stock ?? 0,
          price1: c.price1 ?? 0,
          display_size: c.display_size ?? undefined,
          resolution: c.resolution ?? undefined,
          display_type: c.display_type ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0 && c.package !== ""),
    })
  }

  const displaySizes = await ctx.db
    .selectFrom("lcd_display")
    .select("display_size")
    .distinct()
    .orderBy("display_size")
    .execute()

  const resolutions = await ctx.db
    .selectFrom("lcd_display")
    .select("resolution")
    .distinct()
    .orderBy("resolution")
    .execute()

  const displayTypes = await ctx.db
    .selectFrom("lcd_display")
    .select("display_type")
    .distinct()
    .orderBy("display_type")
    .execute()

  const packages = await ctx.db
    .selectFrom("lcd_display")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  return ctx.react(
    <div>
      <h2>LCD Displays</h2>
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
          <label>Display Size: </label>
          <select name="display_size" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {displaySizes.map((d) => (
              <option
                key={d.display_size}
                value={d.display_size ?? ""}
                selected={d.display_size === params.display_size}
              >
                {d.display_size || "N/A"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Resolution: </label>
          <select name="resolution" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {resolutions.map((r) => (
              <option
                key={r.resolution}
                value={r.resolution ?? ""}
                selected={r.resolution === params.resolution}
              >
                {r.resolution || "N/A"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Display Type: </label>
          <select name="display_type" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {displayTypes.map((t) => (
              <option
                key={t.display_type}
                value={t.display_type ?? ""}
                selected={t.display_type === params.display_type}
              >
                {t.display_type || "N/A"}
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
          display_size: c.display_size ?? "N/A",
          resolution: c.resolution ?? "N/A",
          display_type: c.display_type ?? "N/A",
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price)}</span>,
        }))}
      />
    </div>,
  )
})
