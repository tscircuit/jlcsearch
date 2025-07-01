import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"
import { formatSiUnit } from "lib/util/format-si-unit"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { sql } from "kysely"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
    capacitance: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return undefined
        const valWithUnit = val.endsWith("F") ? val : `${val}F`
        const parsed = parseAndConvertSiUnit(valWithUnit)
        return parsed.value
      }),
  }),
  jsonResponse: z.string().or(
    z.object({
      capacitors: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          capacitance: z.number(),
          voltage: z.number().optional(),
          type: z.string().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("capacitor")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  const params = req.commonParams

  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  // Apply exact capacitance filter
  if (params.capacitance !== undefined) {
    query = query.where(
      sql<boolean>`CEIL(capacitance_farads) = CEIL(${params.capacitance})`,
    )
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("capacitor")
    .select("package")
    .distinct()
    .execute()

  const capacitors = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      capacitors: capacitors
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          package: c.package ?? "",
          capacitance: c.capacitance_farads ?? 0,
          voltage: c.voltage_rating ?? undefined,
          type: c.capacitor_type ?? undefined,
          stock: c.stock ?? undefined,
          price1: c.price1 ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0 && c.package !== ""),
    })
  }

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
                selected={p.package === params.package}
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
            defaultValue={formatSiUnit(params.capacitance)}
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
          price: <span className="tabular-nums">{formatPrice(c.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB Capacitor Search",
  )
})
