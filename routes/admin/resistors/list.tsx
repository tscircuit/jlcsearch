import { Table } from "lib/admin/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    min_resistance: z.string().optional(),
    max_resistance: z.string().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db.selectFrom("resistor").selectAll()

  // Apply package filter
  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  // Apply resistance range filters
  if (req.query.min_resistance) {
    const minOhms = parseAndConvertSiUnit(req.query.min_resistance).value
    if (minOhms) {
      query = query.where("resistance", ">=", minOhms)
    }
  }

  if (req.query.max_resistance) {
    const maxOhms = parseAndConvertSiUnit(req.query.max_resistance).value
    if (maxOhms) {
      query = query.where("resistance", "<=", maxOhms)
    }
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
          <label>Min Resistance:</label>
          <input
            type="text"
            name="min_resistance"
            placeholder="e.g. 1kΩ"
            defaultValue={req.query.min_resistance}
          />
        </div>

        <div>
          <label>Max Resistance:</label>
          <input
            type="text"
            name="max_resistance"
            placeholder="e.g. 10kΩ"
            defaultValue={req.query.max_resistance}
          />
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={resistors.map((r) => ({
          lcsc: r.lcsc,
          mfr: r.mfr,
          package: r.package,
          resistance: `${r.resistance}Ω`,
          tolerance: r.tolerance_fraction
            ? `±${r.tolerance_fraction * 100}%`
            : "",
          power: `${r.power_watts}W`,
          stock: r.stock,
        }))}
      />
    </div>,
  )
})
