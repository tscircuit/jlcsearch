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
    display_width: z.string().optional(),
    pixel_resolution: z.string().optional(),
    mfr: z.string().optional(),
    description: z.string().optional(),
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
        display_width: z.string().optional(),
        pixel_resolution: z.string().optional(),
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
      "display_width",
      "pixel_resolution",
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
  if (params.protocol) {
    query = query.where("protocol", "=", params.protocol)
  }
  if (params.display_width) {
    query = query.where("display_width", "=", params.display_width)
  }
  if (params.pixel_resolution) {
    query = query.where("pixel_resolution", "=", params.pixel_resolution)
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
    protocol: c.protocol,
    display_width: c.display_width,
    pixel_resolution: c.pixel_resolution,
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
          protocol: c.protocol ?? "",
          display_width: c.display_width ?? undefined,
          pixel_resolution: c.pixel_resolution ?? undefined,
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

  const widths = await ctx.db
    .selectFrom("oled_display")
    .select("display_width")
    .distinct()
    .orderBy("display_width")
    .execute()

  const resolutions = await ctx.db
    .selectFrom("oled_display")
    .select("pixel_resolution")
    .distinct()
    .orderBy("pixel_resolution")
    .execute()

  return ctx.react(
    <div>
      <h2>OLED Displays</h2>
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
          <label>Protocol: </label>
          <select name="protocol" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {protocols.map((p) => (
              <option
                key={p.protocol}
                value={p.protocol ?? ""}
                selected={p.protocol === params.protocol}
              >
                {p.protocol || "N/A"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Display Width: </label>
          <select name="display_width" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {widths.map((w) => (
              <option
                key={w.display_width}
                value={w.display_width ?? ""}
                selected={w.display_width === params.display_width}
              >
                {w.display_width || "N/A"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Resolution: </label>
          <select name="pixel_resolution" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {resolutions.map((r) => (
              <option
                key={r.pixel_resolution}
                value={r.pixel_resolution ?? ""}
                selected={r.pixel_resolution === params.pixel_resolution}
              >
                {r.pixel_resolution || "N/A"}
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
          display_width: c.display_width ?? "N/A",
          pixel_resolution: c.pixel_resolution ?? "N/A",
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price)}</span>,
          protocol: c.protocol ?? "N/A",
        }))}
      />
    </div>,
    "JLCPCB OLED Display Search",
  )
})
