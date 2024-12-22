import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import type { DB } from "lib/db/generated/kysely"
import { Kysely } from "kysely"
import { formatPrice } from "lib/util/format-price"
import { Table } from "lib/ui/Table"

type KyselyDatabaseInstance = Kysely<DB>

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
    supply_voltage_min: z.coerce.number().optional(),
    supply_voltage_max: z.coerce.number().optional(),
    output_current_min: z.coerce.number().optional(),
    output_current_max: z.coerce.number().optional(),
    channel_count: z.coerce.number().optional(),
    dimming_method: z.string().optional(),
    efficiency_min: z.coerce.number().optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      led_drivers: z.array(
        z.object({
          lcsc: z.number(),
          mfr: z.string(),
          description: z.string(),
          stock: z.number(),
          price1: z.number().nullable(),
          in_stock: z.boolean(),
          package: z.string().nullable(),
          supply_voltage_min: z.number().nullable(),
          supply_voltage_max: z.number().nullable(),
          output_current_max: z.number().nullable(),
          channel_count: z.number().nullable(),
          dimming_method: z.string().nullable(),
          efficiency_percent: z.number().nullable(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  let query = ctx.db
    .selectFrom("led_driver")
    .selectAll()
    .orderBy("stock", "desc")
    .limit(100)

  if (params.package) {
    query = query.where("package", "=", params.package)
  }
  if (params.supply_voltage_min !== undefined) {
    query = query.where("supply_voltage_min", ">=", params.supply_voltage_min)
  }
  if (params.supply_voltage_max !== undefined) {
    query = query.where("supply_voltage_max", "<=", params.supply_voltage_max)
  }
  if (params.output_current_min !== undefined) {
    query = query.where("output_current_max", ">=", params.output_current_min)
  }
  if (params.output_current_max !== undefined) {
    query = query.where("output_current_max", "<=", params.output_current_max)
  }
  if (params.channel_count !== undefined) {
    query = query.where("channel_count", "=", params.channel_count)
  }
  if (params.dimming_method) {
    query = query.where("dimming_method", "=", params.dimming_method)
  }
  if (params.efficiency_min !== undefined) {
    query = query.where("efficiency_percent", ">=", params.efficiency_min)
  }

  const results = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      led_drivers: results.map((driver) => ({
        lcsc: Number(driver.lcsc),
        mfr: String(driver.mfr || ""),
        description: String(driver.description || ""),
        stock: Number(driver.stock || 0),
        price1: driver.price1 === null ? null : Number(driver.price1),
        in_stock: Boolean((driver.stock || 0) > 0),
        package: driver.package,
        supply_voltage_min: driver.supply_voltage_min,
        supply_voltage_max: driver.supply_voltage_max,
        output_current_max: driver.output_current_max,
        channel_count: driver.channel_count,
        dimming_method: driver.dimming_method,
        efficiency_percent: driver.efficiency_percent,
      })),
    })
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("led_driver")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  // Get unique dimming methods for dropdown
  const dimmingMethods = await ctx.db
    .selectFrom("led_driver")
    .select("dimming_method")
    .distinct()
    .orderBy("dimming_method")
    .where("dimming_method", "is not", null)
    .execute()

  return ctx.react(
    <div>
      <h2>LED Drivers</h2>

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
          <div>Supply Voltage:</div>
          <input
            type="number"
            name="supply_voltage_min"
            placeholder="Min V"
            defaultValue={params.supply_voltage_min}
            step="0.1"
          />
          <input
            type="number"
            name="supply_voltage_max"
            placeholder="Max V"
            defaultValue={params.supply_voltage_max}
            step="0.1"
          />
        </div>

        <div>
          <div>Output Current:</div>
          <input
            type="number"
            name="output_current_min"
            placeholder="Min mA"
            defaultValue={params.output_current_min}
          />
          <input
            type="number"
            name="output_current_max"
            placeholder="Max mA"
            defaultValue={params.output_current_max}
          />
        </div>

        <div>
          <label>Channels:</label>
          <input
            type="number"
            name="channel_count"
            placeholder="# channels"
            defaultValue={params.channel_count}
          />
        </div>

        <div>
          <label>Dimming Method:</label>
          <select name="dimming_method">
            <option value="">All</option>
            {dimmingMethods.map((d) => (
              <option
                key={d.dimming_method}
                value={d.dimming_method ?? ""}
                selected={d.dimming_method === params.dimming_method}
              >
                {d.dimming_method}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Min Efficiency %:</label>
          <input
            type="number"
            name="efficiency_min"
            placeholder="Min %"
            defaultValue={params.efficiency_min}
          />
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={results.map((d) => ({
          lcsc: d.lcsc,
          mfr: d.mfr,
          package: d.package,
          description: d.description,
          voltage: d.supply_voltage_min && (
            <span className="tabular-nums">
              {d.supply_voltage_min}-{d.supply_voltage_max}V
            </span>
          ),
          current: d.output_current_max && (
            <span className="tabular-nums">{d.output_current_max}mA</span>
          ),
          channels: d.channel_count,
          dimming: d.dimming_method,
          efficiency: d.efficiency_percent && (
            <span className="tabular-nums">{d.efficiency_percent}%</span>
          ),
          stock: <span className="tabular-nums">{d.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(d.price1)}</span>,
        }))}
      />
    </div>,
  )
})
