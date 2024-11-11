import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  commonParams: z.object({
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
  jsonResponse: z.object({
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
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("capacitor")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  const params = req.commonParams

  // Apply package filter
  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  // Apply exact capacitance filter
  if (params.capacitance !== undefined) {
    query = query.where("capacitance_farads", "=", params.capacitance)
  }

  const capacitors = await query.execute()

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
})
