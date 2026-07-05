import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { formatSiUnit } from "lib/util/format-si-unit"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
    is_basic: z.boolean().optional(),
    is_preferred: z.boolean().optional(),
    resistance: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return undefined
        const valWithUnit = `${val}Ω`
        const parsed = parseAndConvertSiUnit(valWithUnit)
        return parsed.value
      }),
  }),
  jsonResponse: z.string().or(
    z.object({
      resistors: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          is_basic: z.boolean(),
          is_preferred: z.boolean(),
          resistance: z.number(),
          tolerance_fraction: z.number().optional(),
          power_watts: z.number().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("resistor")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  const params = req.commonParams

  // Apply package filter
  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  if (params.is_basic) {
    query = query.where("is_basic", "=", 1)
  }
  if (params.is_preferred) {
    query = query.where("is_preferred", "=", 1)
  }

  // Apply resistance filter with a small tolerance for rounding errors
  if (params.resistance != null) {
    const delta = params.resistance * 0.0001
    query = query
      .where("resistance", ">=", params.resistance - delta)
      .where("resistance", "<=", params.resistance + delta)
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("resistor")
    .select("package")
    .distinct()
    .execute()

  const resistors = await query.execute()
  if (ctx.isApiRequest) {
    return ctx.json({
      resistors: resistors
        .map((r) => ({
          lcsc: r.lcsc ?? 0,
          mfr: r.mfr ?? "",
          package: r.package ?? "",
          is_basic: Boolean(r.is_basic),
          is_preferred: Boolean(r.is_preferred),
          resistance: r.resistance ?? 0,
          tolerance_fraction: r.tolerance_fraction ?? undefined,
          power_watts: r.power_watts ?? undefined,
          stock: r.stock ?? undefined,
          price1: r.price1 ?? undefined,
        }))
        .filter((r) => r.lcsc !== 0 && r.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>Resistors</h2>

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
          <label>
            Basic Part:
            <input
              type="checkbox"
              name="is_basic"
              value="true"
              checked={params.is_basic}
            />
          </label>
        </div>

        <div>
          <label>
            Preferred Part:
            <input
              type="checkbox"
              name="is_preferred"
              value="true"
              checked={params.is_preferred}
            />
          </label>
        </div>

        <div>
          <label>Resistance:</label>
          <input
            type="text"
            name="resistance"
            placeholder="e.g. 10kΩ"
            defaultValue={formatSiUnit(params.resistance)}
          />
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={resistors.map((r) => ({
          lcsc: r.lcsc,
          mfr: r.mfr,
          package: r.package,
          is_basic: r.is_basic ? "✓" : "",
          is_preferred: r.is_preferred ? "✓" : "",
          resistance: (
            <span className="tabular-nums">{formatSiUnit(r.resistance)}Ω</span>
          ),
          tolerance: (
            <span className="tabular-nums">
              {r.tolerance_fraction ? `±${r.tolerance_fraction * 100}%` : ""}
            </span>
          ),
          power: <span className="tabular-nums">{r.power_watts}W</span>,
          stock: <span className="tabular-nums">{r.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(r.price1)}</span>,
        }))}
      />
    </div>,
  )
})
