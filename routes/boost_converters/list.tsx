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
    input_voltage: z.coerce.number().optional(),
    output_voltage: z.coerce.number().optional(),
    output_current: z.coerce.number().optional(),
  }),
  jsonResponse: z.object({
    boost_converters: z.array(
      z.object({
        lcsc: z.number(),
        mfr: z.string(),
        description: z.string(),
        stock: z.number(),
        price1: z.number().nullable(),
        in_stock: z.boolean(),
        package: z.string(),
        input_voltage_min: z.number().nullable(),
        input_voltage_max: z.number().nullable(),
        output_voltage_min: z.number().nullable(),
        output_voltage_max: z.number().nullable(),
        output_current_max: z.number().nullable(),
      }),
    ),
  }),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  let query = ctx.db
    .selectFrom("boost_converter")
    .selectAll()
    .orderBy("stock", "desc")
    .limit(100)

  if (params.package) {
    query = query.where("package", "=", params.package)
  }
  if (params.input_voltage !== undefined) {
    query = query
      .where("input_voltage_min", "<=", params.input_voltage)
      .where("input_voltage_max", ">=", params.input_voltage)
  }
  if (params.output_voltage !== undefined) {
    query = query.where((eb) =>
      eb.or([
        eb("output_voltage_min", "<=", params.output_voltage!),
        eb("output_voltage_max", ">=", params.output_voltage!),
      ]),
    )
  }
  if (params.output_current !== undefined) {
    query = query.where("output_current_max", ">=", params.output_current)
  }

  const converters = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      boost_converters: converters.map((c) => ({
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        price1: c.price1,
        in_stock: c.in_stock === 1 || c.in_stock === true,
        package: c.package,
        input_voltage_min: c.input_voltage_min,
        input_voltage_max: c.input_voltage_max,
        output_voltage_min: c.output_voltage_min,
        output_voltage_max: c.output_voltage_max,
        output_current_max: c.output_current_max,
      })),
    })
  }

  const packages = await ctx.db
    .selectFrom("boost_converter")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  return ctx.react(
    <div>
      <h2>Boost DC-DC Converters</h2>

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
          <label>Input Voltage:</label>
          <input
            type="number"
            step="0.1"
            name="input_voltage"
            defaultValue={params.input_voltage}
          />
        </div>

        <div>
          <label>Output Voltage:</label>
          <input
            type="number"
            step="0.1"
            name="output_voltage"
            defaultValue={params.output_voltage}
          />
        </div>

        <div>
          <label>Output Current &ge;:</label>
          <input
            type="number"
            step="0.1"
            name="output_current"
            defaultValue={params.output_current}
          />
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={converters.map((c) => ({
          lcsc: c.lcsc,
          mfr: c.mfr,
          package: c.package,
          input:
            c.input_voltage_min && c.input_voltage_max
              ? `${c.input_voltage_min}V - ${c.input_voltage_max}V`
              : "",
          output:
            c.output_voltage_min && c.output_voltage_max
              ? `${c.output_voltage_min}V - ${c.output_voltage_max}V`
              : "",
          current: c.output_current_max ? `${c.output_current_max}A` : "",
          stock: c.stock,
          price: <span className="tabular-nums">{formatPrice(c.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB Boost Converter Search",
  )
})
