import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { formatSiUnit } from "lib/util/format-si-unit"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
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
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("resistor")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  // Apply exact resistance filter
  if (req.query.resistance !== undefined) {
    query = query.where("resistance", "=", req.query.resistance)
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("resistor")
    .select("package")
    .distinct()
    .execute()

  const resistors = await query.execute()

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
                selected={p.package === req.query.package}
              >
                {p.package}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Resistance:</label>
          <input
            type="text"
            name="resistance"
            placeholder="e.g. 10kΩ"
            defaultValue={formatSiUnit(req.query.resistance)}
          />
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={resistors.map((r) => ({
          lcsc: r.lcsc,
          mfr: r.mfr,
          package: r.package,
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
