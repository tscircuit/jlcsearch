import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { formatSiUnit } from "lib/util/format-si-unit"
import { formatPrice } from "lib/util/format-price"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      reflective_optical_interrupters: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          sensing_distance_mm: z.number().optional(),
          collector_current_ma: z.number().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  const params = req.commonParams

  let query = ctx.db
    .selectFrom("components")
    .innerJoin("categories", "components.category_id", "categories.id")
    .select([
      "components.lcsc as lcsc",
      "components.mfr as mfr",
      "components.package as package",
      "components.description as description",
      "components.stock as stock",
      "components.price as price",
      "components.extra as extra",
    ])
    .where("categories.subcategory", "=", "Reflective Optical Interrupters")
    .limit(100)
    .orderBy("components.stock", "desc")

  if (params.package) {
    query = query.where("components.package", "=", params.package)
  }

  const packages = await ctx.db
    .selectFrom("components")
    .innerJoin("categories", "components.category_id", "categories.id")
    .select("components.package")
    .where("categories.subcategory", "=", "Reflective Optical Interrupters")
    .distinct()
    .where("components.package", "is not", null)
    .orderBy("components.package")
    .execute()

  const rows = await query.execute()

  const mapped = rows
    .map((r) => {
      let sensing: number | undefined
      let collector: number | undefined
      if (r.extra) {
        try {
          const extra = JSON.parse(r.extra as string)
          const attrs = extra.attributes || {}
          if (attrs["Sensing Distance"]) {
            const val = parseAndConvertSiUnit(attrs["Sensing Distance"]).value
            if (!Number.isNaN(val)) sensing = val
          }
          if (attrs["Collector Current (Max)"]) {
            const val =
              parseAndConvertSiUnit(attrs["Collector Current (Max)"]).value *
              1000
            if (!Number.isNaN(val)) collector = val
          }
        } catch {}
      }
      return {
        lcsc: r.lcsc ?? 0,
        mfr: r.mfr ?? "",
        package: r.package ?? "",
        sensing_distance_mm: sensing,
        collector_current_ma: collector,
        stock: r.stock ?? undefined,
        price1: r.price ? (extractMinQPrice(r.price) ?? undefined) : undefined,
      }
    })
    .filter((r) => r.lcsc !== 0 && r.package !== "")

  if (ctx.isApiRequest) {
    return ctx.json({
      reflective_optical_interrupters: mapped,
    })
  }

  return ctx.react(
    <div>
      <h2>Reflective Optical Interrupters</h2>
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
        <button type="submit">Filter</button>
      </form>
      <Table
        rows={mapped.map((c) => ({
          lcsc: c.lcsc,
          mfr: c.mfr,
          package: c.package,
          sensing_distance: c.sensing_distance_mm
            ? `${formatSiUnit(c.sensing_distance_mm)}mm`
            : "",
          collector_current: c.collector_current_ma
            ? `${formatSiUnit(c.collector_current_ma)}A`
            : "",
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price1)}</span>,
        }))}
      />
    </div>,
  )
})
