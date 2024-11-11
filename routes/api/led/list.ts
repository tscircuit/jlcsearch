import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  commonParams: z.object({
    package: z.string().optional(),
    color: z.string().optional(),
  }),
  jsonResponse: z.object({
    leds: z.array(
      z.object({
        lcsc: z.number().int(),
        mfr: z.string(),
        package: z.string(),
        color: z.string().optional(),
        wavelength_nm: z.number().optional(),
        forward_voltage: z.number().optional(),
        forward_current: z.number().optional(),
        luminous_intensity_mcd: z.number().optional(),
        stock: z.number().optional(),
        price1: z.number().optional(),
      }),
    ),
  }),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("led")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  const params = req.commonParams

  // Apply package filter
  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  // Apply color filter
  if (params.color) {
    query = query.where("color", "=", params.color)
  }

  const leds = await query.execute()

  return ctx.json({
    leds: leds
      .map((led) => ({
        lcsc: led.lcsc ?? 0,
        mfr: led.mfr ?? "",
        package: led.package ?? "",
        color: led.color ?? undefined,
        wavelength_nm: led.wavelength_nm ?? undefined,
        forward_voltage: led.forward_voltage ?? undefined,
        forward_current: led.forward_current ?? undefined,
        luminous_intensity_mcd: led.luminous_intensity_mcd ?? undefined,
        stock: led.stock ?? undefined,
        price1: led.price1 ?? undefined,
      }))
      .filter((led) => led.lcsc !== 0 && led.package !== ""),
  })
})
