import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    pitch: z.string().optional(),
    num_pins: z.coerce.number().optional(),
    is_right_angle: z.boolean().optional(),
    gender: z.enum(["male", "female"]).optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("header")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply filters
  if (req.query.pitch) {
    query = query.where("pitch_mm", "=", parseFloat(req.query.pitch))
  }

  if (req.query.num_pins) {
    query = query.where("num_pins", "=", req.query.num_pins)
  }

  if (req.query.is_right_angle !== undefined) {
    query = query.where("is_right_angle", "=", req.query.is_right_angle)
  }

  if (req.query.gender) {
    query = query.where("gender", "=", req.query.gender)
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
                value={p.pitch_mm}
                selected={p.pitch_mm?.toString() === req.query.pitch}
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
                value={p.num_pins}
                selected={p.num_pins === req.query.num_pins}
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
            <option value="male" selected={req.query.gender === "male"}>
              Male
            </option>
            <option value="female" selected={req.query.gender === "female"}>
              Female
            </option>
          </select>
        </div>

        <div>
          <label>Right Angle:</label>
          <select name="is_right_angle">
            <option value="">All</option>
            <option value="true" selected={req.query.is_right_angle === true}>
              Yes
            </option>
            <option value="false" selected={req.query.is_right_angle === false}>
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
        }))}
      />
    </div>,
  )
})
