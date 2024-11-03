import { Table } from "lib/admin/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { formatSiUnit } from "lib/util/format-si-unit"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    capacitance: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return undefined
        const valWithUnit = val.endsWith("F") ? val : `${val}F`
        const parsed = parseAndConvertSiUnit(valWithUnit)
        console.log({ val, valWithUnit, parsed })
        return parsed.value
      }),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("capacitor")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  // Apply exact capacitance filter
  if (req.query.capacitance) {
    query = query.where("capacitance_farads", "=", req.query.capacitance)
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("capacitor")
    .select("package")
    .distinct()
    .execute()

  const capacitors = await query.execute()

  return ctx.react(
    <div>
      <h2>Capacitors</h2>

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
          <label>Capacitance:</label>
          <input
            type="text"
            name="capacitance"
            placeholder="e.g. 10µF"
            defaultValue={formatSiUnit(req.query.capacitance)}
          />
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={capacitors.map((c) => ({
          lcsc: c.lcsc,
          mfr: c.mfr,
          package: c.package,
          capacitance: (
            <span className="tabular-nums">
              {formatSiUnit(c.capacitance_farads)}F
            </span>
          ),
          voltage: <span className="tabular-nums">{c.voltage_rating}V</span>,
          type: c.capacitor_type,
          stock: <span className="tabular-nums">{c.stock}</span>,
        }))}
      />
    </div>,
  )
})
