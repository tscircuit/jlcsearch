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
    size: z.string().optional(),
    pixelResolution: z.string().optional(),
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
        size: z.string().optional(),
        pixelResolution: z.string().optional(),
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
      "size",
      "pixelResolution",
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
  if (params.size) {
    query = query.where("size", "=", params.size)
  }
  if (params.pixelResolution) {
    query = query.where("pixelResolution", "=", params.pixelResolution)
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
    size: c.size,
    pixelResolution: c.pixelResolution,
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
          size: c.size ?? undefined,
          pixelResolution: c.pixelResolution ?? undefined,
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

  const sizes = await ctx.db
    .selectFrom("oled_display")
    .select("size")
    .distinct()
    .orderBy("size")
    .execute()

  const resolutions = await ctx.db
    .selectFrom("oled_display")
    .select("pixelResolution")
    .distinct()
    .orderBy("pixelResolution")
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
          <label>Resolution: </label>
          <select name="pixelResolution" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {resolutions.map((r) => (
              <option
                key={r.pixelResolution}
                value={r.pixelResolution ?? ""}
                selected={r.pixelResolution === params.pixelResolution}
              >
                {r.pixelResolution || "N/A"}
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
          size: c.size ?? "N/A",
          pixelResolution: c.pixelResolution ?? "N/A",
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price)}</span>,
          protocol: c.protocol ?? "N/A",
        }))}
      />
    </div>,
  )
})
