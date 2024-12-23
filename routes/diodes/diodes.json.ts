import { withWinterSpec } from "../../lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  commonParams: z.object({
    package: z
      .string()
      .transform((val) => (val === "All" ? undefined : val))
      .optional(),
    diode_type: z
      .enum([
        "general_purpose",
        "schottky_barrier",
        "zener",
        "tvs",
        "switching",
        "fast_recovery",
        "bridge_rectifier",
        "All",
        "",
      ])
      .transform((val) => (val === "All" ? undefined : val))
      .optional(),
  }),
  jsonResponse: z.object({
    diodes: z.array(
      z.object({
        lcsc: z.number().int(),
        mfr: z.string(),
        package: z.string(),
        diode_type: z.string(),
        forward_voltage: z.number().optional(),
        reverse_voltage: z.number().optional(),
        forward_current: z.number().optional(),
        recovery_time_ns: z.number().optional(),
        stock: z.number().optional(),
        price1: z.number().optional(),
      }),
    ),
  }),
} as const)(async (req, ctx) => {
  const params = req.commonParams

  // Start with base query
  let query = ctx.db
    .selectFrom("diode")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  // Apply diode type filter
  if (params.diode_type) {
    query = query.where("diode_type", "=", params.diode_type)
  }

  const diodes = await query.execute()

  return ctx.json({
    diodes: diodes
      .map((d) => ({
        lcsc: d.lcsc ?? 0,
        mfr: d.mfr ?? "",
        package: d.package ?? "",
        diode_type: d.diode_type ?? "",
        forward_voltage: d.forward_voltage ?? undefined,
        reverse_voltage: d.reverse_voltage ?? undefined,
        forward_current: d.forward_current ?? undefined,
        recovery_time_ns: d.recovery_time_ns ?? undefined,
        stock: d.stock ?? undefined,
        price1: d.price1 ?? undefined,
      }))
      .filter((d) => d.lcsc !== 0 && d.package !== ""),
  })
})
