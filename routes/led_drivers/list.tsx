import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import type { DB } from "lib/db/generated/kysely"
import { Kysely } from "kysely"

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
        })
      ),
    })
  ),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  let query = (ctx.db as KyselyDatabaseInstance)
    .selectFrom("led_driver")
    .select([
      "lcsc",
      "mfr",
      "description",
      "stock",
      "price1",
      "in_stock",
      "package",
      "supply_voltage_min",
      "supply_voltage_max",
      "output_current_max",
      "channel_count",
      "dimming_method",
      "efficiency_percent",
      "operating_temp_min",
      "operating_temp_max",
      "protection_features",
      "mounting_style"
    ])
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

  // TODO: Add UI implementation similar to leds/list.tsx when needed
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
})
