import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  commonParams: z.object({
    json: z.boolean().optional(),
    pitch: z.string().optional(),
    num_pins: z.coerce.number().optional(),
    is_right_angle: z.boolean().optional(),
    gender: z.enum(["male", "female", ""]).optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      headers: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          pitch_mm: z.number().optional(),
          num_pins: z.number().optional(),
          gender: z.string().optional(),
          is_right_angle: z.coerce.boolean().optional(),
          voltage_rating: z.number().optional(),
          current_rating: z.number().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
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

  // Get unique pitches for dropdown
  const pitches = await ctx.db
    .selectFrom("header")
    .select("pitch_mm")
    .distinct()
    .orderBy("pitch_mm")
    .execute()

  // Get unique pin counts for dropdown
  const pinCounts = await ctx.db
    .selectFrom("header")
    .select("num_pins")
    .distinct()
    .orderBy("num_pins")
    .execute()

  const headers = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      headers: headers
        .map((h) => ({
          lcsc: h.lcsc ?? 0,
          mfr: h.mfr ?? "",
          package: h.package ?? "",
          pitch_mm: h.pitch_mm ?? undefined,
          num_pins: h.num_pins ?? undefined,
          gender: h.gender ?? undefined,
          is_right_angle: Boolean(h.is_right_angle ?? undefined),
          voltage_rating: h.voltage_rating_volt ?? undefined,
          current_rating: h.current_rating_amp ?? undefined,
          stock: h.stock ?? undefined,
          price1: h.price1 ?? undefined,
        }))
        .filter((h) => h.lcsc !== 0 && h.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>Headers</h2>

      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Pitch:</label>
          <select name="pitch">
            <option value="">All</option>
            {pitches.map((p) => (
              <option
                key={p.pitch_mm}
                value={p.pitch_mm!}
                selected={p.pitch_mm?.toString() === params.pitch}
              >
                {p.pitch_mm}mm
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Number of Pins:</label>
          <select name="num_pins">
            <option value="">All</option>
            {pinCounts.map((p) => (
              <option
                key={p.num_pins}
                value={p.num_pins?.toString() ?? ""}
                selected={p.num_pins === params.num_pins}
              >
                {p.num_pins}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Gender:</label>
          <select name="gender">
            <option value="">All</option>
            <option value="male" selected={params.gender === "male"}>
              Male
            </option>
            <option value="female" selected={params.gender === "female"}>
              Female
            </option>
          </select>
        </div>

        <div>
          <label>Right Angle:</label>
          <select name="is_right_angle">
            <option value="">All</option>
            <option value="true" selected={params.is_right_angle === true}>
              Yes
            </option>
            <option value="false" selected={params.is_right_angle === false}>
              No
            </option>
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={headers.map((h) => ({
          lcsc: h.lcsc,
          mfr: h.mfr,
          package: h.package,
          pitch: <span className="tabular-nums">{h.pitch_mm}mm</span>,
          pins: (
            <span className="tabular-nums">
              {h.num_rows}×{h.num_pins_per_row} ({h.num_pins})
            </span>
          ),
          gender: h.gender,
          mounting: (
            <>
              {h.mounting_style}
              {h.is_right_angle && " (Right Angle)"}
              {h.is_shrouded && " (Shrouded)"}
            </>
          ),
          voltage: h.voltage_rating_volt && (
            <span className="tabular-nums">{h.voltage_rating_volt}V</span>
          ),
          current: h.current_rating_amp && (
            <span className="tabular-nums">{h.current_rating_amp}A</span>
          ),
          stock: <span className="tabular-nums">{h.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(h.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB Header Search",
  )
})
