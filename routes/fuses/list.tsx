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
    current_rating: z.string().optional(),
    voltage_rating: z.string().optional(),
    response_time: z.string().optional(),
    mfr: z.string().optional(),
    description: z.string().optional(),
  }),
  jsonResponse: z.object({
    fuses: z.array(
      z.object({
        lcsc: z.number(),
        mfr: z.string(),
        package: z.string(),
        description: z.string(),
        stock: z.number(),
        price1: z.number(),
        current_rating: z.number(),
        voltage_rating: z.number(),
        response_time: z.string(),
        is_surface_mount: z.boolean(),
        is_glass_encased: z.boolean(),
        is_resettable: z.boolean(),
      }),
    ),
  }),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  const limit = 100
  const search = "fuse"
  const searchPattern = `%${search}%`

  let query = ctx.db
    .selectFrom("fuse")
    .select([
      "lcsc",
      "mfr",
      "package",
      "description",
      "stock",
      "price1",
      "current_rating",
      "voltage_rating",
      "response_time",
      "is_surface_mount",
      "is_glass_encased",
      "is_resettable",
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
  if (params.current_rating) {
    query = query.where(
      "current_rating",
      "=",
      parseFloat(params.current_rating),
    )
  }
  if (params.voltage_rating) {
    query = query.where(
      "voltage_rating",
      "=",
      parseFloat(params.voltage_rating),
    )
  }
  if (params.response_time) {
    query = query.where("response_time", "=", params.response_time)
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
    current_rating: c.current_rating,
    voltage_rating: c.voltage_rating,
    response_time: c.response_time,
    is_surface_mount: Boolean(c.is_surface_mount),
    is_glass_encased: Boolean(c.is_glass_encased),
    is_resettable: Boolean(c.is_resettable),
  }))

  if (ctx.isApiRequest) {
    return ctx.json({
      fuses: fullComponents
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          package: c.package ?? "",
          description: c.description ?? "",
          stock: c.stock ?? 0,
          price1: c.price1 ?? 0,
          current_rating: c.current_rating ?? 0,
          voltage_rating: c.voltage_rating ?? 0,
          response_time: c.response_time ?? "",
          is_surface_mount: Boolean(c.is_surface_mount),
          is_glass_encased: Boolean(c.is_glass_encased),
          is_resettable: Boolean(c.is_resettable),
        }))
        .filter((c) => c.lcsc !== 0 && c.package !== ""),
    })
  }

  const packages = await ctx.db
    .selectFrom("fuse")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  const responseTimes = await ctx.db
    .selectFrom("fuse")
    .select("response_time")
    .distinct()
    .orderBy("response_time")
    .execute()

  return ctx.react(
    <div>
      <h2>Fuses</h2>
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
          <label>Response Time: </label>
          <select name="response_time" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {responseTimes.map((r) => (
              <option
                key={r.response_time}
                value={r.response_time ?? ""}
                selected={r.response_time === params.response_time}
              >
                {r.response_time || "-"}
              </option>
            ))}
          </select>
        </div>
      </form>
      <Table rows={components} timezone="UTC" />
    </div>,
  )
})
