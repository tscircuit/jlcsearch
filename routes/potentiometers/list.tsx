import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { formatSiUnit } from "lib/util/format-si-unit"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
    maxResistance: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return undefined
        const valWithUnit = `${val}Ω`
        const parsed = parseAndConvertSiUnit(valWithUnit)
        return parsed.value
      }),
    pinVariant: z.enum(["two_pin", "three_pin"]).optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      potentiometers: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          maxResistance: z.number(),
          pinVariant: z.string(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("potentiometer")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  const params = req.commonParams

  // Apply package filter
  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  // Apply resistance filter with a small tolerance for rounding errors
  if (params.maxResistance != null) {
    const delta = params.maxResistance * 0.0001
    query = query
      .where("max_resistance", ">=", params.maxResistance - delta)
      .where("max_resistance", "<=", params.maxResistance + delta)
  }

  // Apply pin variant filter
  if (params.pinVariant) {
    query = query.where("pin_variant", "=", params.pinVariant)
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("potentiometer")
    .select("package")
    .distinct()
    .execute()

  const potentiometers = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      potentiometers: potentiometers
        .map((p) => ({
          lcsc: p.lcsc ?? 0,
          mfr: p.mfr ?? "",
          package: p.package ?? "",
          maxResistance: p.max_resistance ?? 0,
          pinVariant: p.pin_variant ?? "two_pin",
          stock: p.stock ?? undefined,
          price1: p.price1 ?? undefined,
        }))
        .filter((p) => p.lcsc !== 0 && p.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>Potentiometers</h2>

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
          <label>Max Resistance:</label>
          <input
            type="text"
            name="maxResistance"
            placeholder="e.g. 10kΩ"
            defaultValue={formatSiUnit(params.maxResistance)}
          />
        </div>

        <div>
          <label>Pin Variant:</label>
          <select name="pinVariant">
            <option value="">All</option>
            <option value="two_pin" selected={params.pinVariant === "two_pin"}>
              2-Pin
            </option>
            <option
              value="three_pin"
              selected={params.pinVariant === "three_pin"}
            >
              3-Pin
            </option>
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={potentiometers.map((p) => ({
          lcsc: p.lcsc,
          mfr: p.mfr,
          package: p.package,
          maxResistance: (
            <span className="tabular-nums">
              {formatSiUnit(p.max_resistance)}Ω
            </span>
          ),
          pinVariant: p.pin_variant === "two_pin" ? "2-Pin" : "3-Pin",
          stock: <span className="tabular-nums">{p.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(p.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB Potentiometer Search",
  )
})
