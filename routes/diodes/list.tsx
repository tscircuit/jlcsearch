import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
    diode_type: z.enum([
      "general_purpose",
      "schottky_barrier",
      "zener",
      "tvs",
      "switching",
      "fast_recovery", 
      "bridge_rectifier",
      "",
    ]).optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      diodes: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          diode_type: z.string(),
          forward_voltage: z.number().optional(),
          reverse_voltage: z.number().optional(),
          forward_current: z.number().optional(),
          recovery_time_ns: z.number().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  const params = req.commonParams

  // Start with base query
  let query = ctx.db
    .selectFrom("diode")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  // Apply diode type filter
  if (params.diode_type) {
    query = query.where("diode_type", "=", params.diode_type)
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("diode")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  // Get unique diode types for dropdown
  const diodeTypes = await ctx.db
    .selectFrom("diode")
    .select("diode_type")
    .distinct()
    .orderBy("diode_type")
    .execute()

  const diodes = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      diodes: diodes
        .map((d) => ({
          lcsc: d.lcsc ?? 0,
          mfr: d.mfr ?? "",
          package: d.package ?? "",
          diode_type: d.diode_type ?? "",
          forward_voltage: d.forward_voltage ?? undefined,
          reverse_voltage: d.reverse_voltage ?? undefined,
          forward_current: d.forward_current ?? undefined,
          recovery_time_ns: d.recovery_time_ns ?? undefined,
          stock: d.stock ?? undefined,
          price1: d.price1 ?? undefined,
        }))
        .filter((d) => d.lcsc !== 0 && d.package !== ""),
    })
  }

  const formatDiodeType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  return ctx.react(
    <div>
      <h2>Diodes</h2>

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
          <label>Type:</label>
          <select name="diode_type">
            <option value="">All</option>
            {diodeTypes.map((t) => (
              <option
                key={t.diode_type}
                value={t.diode_type ?? ""}
                selected={t.diode_type === params.diode_type}
              >
                {formatDiodeType(t.diode_type ?? "")}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={diodes.map((d) => ({
          lcsc: d.lcsc,
          mfr: d.mfr,
          package: d.package,
          type: formatDiodeType(d.diode_type),
          forward_voltage: d.forward_voltage ? `${d.forward_voltage}V` : "",
          reverse_voltage: d.reverse_voltage ? `${d.reverse_voltage}V` : "",
          forward_current: d.forward_current ? `${d.forward_current}A` : "",
          recovery_time: d.recovery_time_ns ? `${d.recovery_time_ns}ns` : "",
          power: d.power_dissipation_watts ? `${d.power_dissipation_watts}W` : "",
          stock: <span className="tabular-nums">{d.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(d.price1)}</span>,
        }))}
      />
    </div>,
  )
})
