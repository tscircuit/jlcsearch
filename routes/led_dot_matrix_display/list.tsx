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
    matrix_size: z.string().optional(),
    color: z.string().optional(),
    led_type: z.string().optional(),
    mfr: z.string().optional(),
    description: z.string().optional(),
  }),
  jsonResponse: z.object({
    led_matrices: z.array(
      z.object({
        lcsc: z.number(),
        mfr: z.string(),
        package: z.string(),
        description: z.string(),
        stock: z.number(),
        price1: z.number(),
        matrix_size: z.string().optional(),
        color: z.string().optional(),
        led_type: z.string().optional(),
      }),
    ),
  }),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  const limit = 100
  const search = "LED Dot Matrix"
  const searchPattern = `%${search}%`

  let query = ctx.db
    .selectFrom("led_matrix")
    .select([
      "lcsc",
      "mfr",
      "package",
      "description",
      "stock",
      "price1",
      "matrix_size",
      "color",
      "led_type",
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
  if (params.matrix_size) {
    query = query.where("matrix_size", "=", params.matrix_size)
  }
  if (params.color) {
    query = query.where("color", "=", params.color)
  }
  if (params.led_type) {
    query = query.where("led_type", "=", params.led_type)
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
    matrix_size: c.matrix_size,
    color: c.color,
    led_type: c.led_type,
  }))

  if (ctx.isApiRequest) {
    return ctx.json({
      led_matrices: fullComponents
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          package: c.package ?? "",
          description: c.description ?? "",
          stock: c.stock ?? 0,
          price1: c.price1 ?? 0,
          matrix_size: c.matrix_size ?? undefined,
          color: c.color ?? undefined,
          led_type: c.led_type ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0 && c.package !== ""),
    })
  }

  const matrixSizes = await ctx.db
    .selectFrom("led_matrix")
    .select("matrix_size")
    .distinct()
    .orderBy("matrix_size")
    .execute()

  const colors = await ctx.db
    .selectFrom("led_matrix")
    .select("color")
    .distinct()
    .orderBy("color")
    .execute()

  const ledTypes = await ctx.db
    .selectFrom("led_matrix")
    .select("led_type")
    .distinct()
    .orderBy("led_type")
    .execute()

  const packages = await ctx.db
    .selectFrom("led_matrix")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  return ctx.react(
    <div>
      <h2>LED Dot Matrix Displays</h2>
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
          <label>Matrix Size: </label>
          <select name="matrix_size" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {matrixSizes.map((m) => (
              <option
                key={m.matrix_size}
                value={m.matrix_size ?? ""}
                selected={m.matrix_size === params.matrix_size}
              >
                {m.matrix_size || "N/A"}
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
        <div>
          <label>LED Type: </label>
          <select name="led_type" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {ledTypes.map((t) => (
              <option
                key={t.led_type}
                value={t.led_type ?? ""}
                selected={t.led_type === params.led_type}
              >
                {t.led_type || "N/A"}
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
          matrix_size: c.matrix_size ?? "N/A",
          color: c.color ?? "N/A",
          led_type: c.led_type ?? "N/A",
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price)}</span>,
        }))}
      />
    </div>,
  )
})
