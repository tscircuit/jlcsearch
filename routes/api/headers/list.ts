import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  commonParams: z.object({
    pitch: z.string().optional(),
    num_pins: z.coerce.number().optional(),
    is_right_angle: z.boolean().optional(),
    gender: z.enum(["male", "female"]).optional(),
  }),
  jsonResponse: z.object({
    headers: z.array(
      z.object({
        lcsc: z.number().int(),
        mfr: z.string(),
        package: z.string(),
        pitch_mm: z.number().optional(),
        num_pins: z.number().optional(),
        gender: z.string().optional(),
        is_right_angle: z.boolean().optional(),
        voltage_rating: z.number().optional(),
        current_rating: z.number().optional(),
        stock: z.number().optional(),
        price1: z.number().optional(),
      }),
    ),
  }),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("header")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  const params = req.commonParams

  // Apply filters
  if (params.pitch) {
    query = query.where("pitch_mm", "=", parseFloat(params.pitch))
  }

  if (params.num_pins) {
    query = query.where("num_pins", "=", params.num_pins)
  }

  if (params.is_right_angle !== undefined) {
    query = query.where("is_right_angle", "=", params.is_right_angle ? 1 : 0)
  }

  if (params.gender) {
    query = query.where("gender", "=", params.gender)
  }

  const headers = await query.execute()
  return ctx.json({
    headers: headers
      .map((h) => ({
        lcsc: h.lcsc ?? 0,
        mfr: h.mfr ?? "",
        package: h.package ?? "",
        is_right_angle: h.is_right_angle ? true : undefined,
        pitch_mm: h.pitch_mm ?? undefined,
        num_pins: h.num_pins ?? undefined,
        gender: h.gender ?? undefined,
        voltage_rating: h.voltage_rating_volt ?? undefined,
        current_rating: h.current_rating_amp ?? undefined,
        stock: h.stock ?? undefined,
        price1: h.price1 ?? undefined,
      }))
      .filter((h) => h.lcsc !== 0 && h.package !== ""),
  })
})
