import { Table } from "lib/ui/Table"
import { formatPrice } from "lib/util/format-price"
import { withWinterSpec } from "lib/with-winter-spec"
import { boolish } from "lib/zod"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  commonParams: z.object({
    json: z.boolean().optional(),
    pitch: z.string().optional(),
    series: z.string().optional(),
    is_smd: z
      .union([z.literal(""), boolish])
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      wire_to_board_connectors: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          pitch_mm: z.number().optional(),
          num_rows: z.number().optional(),
          num_pins_per_row: z.number().optional(),
          num_pins: z.number().optional(),
          reference_series: z.string().optional(),
          mounting_style: z.string().optional(),
          gender: z.string().optional(),
          is_smd: z.coerce.boolean().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  let query = ctx.db
    .selectFrom("wire_to_board_connector")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  const params = req.commonParams

  if (params.pitch) {
    const p = Number(params.pitch)
    if (!Number.isNaN(p)) {
      query = query.where("pitch_mm", "=", p)
    }
  }

  if (params.series) {
    query = query.where("reference_series", "=", params.series)
  }

  if (params.is_smd !== undefined) {
    query = query.where("is_smd", "=", params.is_smd ? 1 : 0)
  }

  const pitches = await ctx.db
    .selectFrom("wire_to_board_connector")
    .select("pitch_mm")
    .distinct()
    .where("pitch_mm", "is not", null)
    .orderBy("pitch_mm")
    .execute()

  const seriesList = await ctx.db
    .selectFrom("wire_to_board_connector")
    .select("reference_series")
    .distinct()
    .where("reference_series", "is not", null)
    .orderBy("reference_series")
    .execute()

  const connectors = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      wire_to_board_connectors: connectors
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          package: c.package ?? "",
          pitch_mm: c.pitch_mm ?? undefined,
          num_rows: c.num_rows ?? undefined,
          num_pins_per_row: c.num_pins_per_row ?? undefined,
          num_pins: c.num_pins ?? undefined,
          reference_series: c.reference_series ?? undefined,
          mounting_style: c.mounting_style ?? undefined,
          gender: c.gender ?? undefined,
          is_smd: Boolean(c.is_smd ?? undefined),
          stock: c.stock ?? undefined,
          price1: c.price1 ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0 && c.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>Wire to Board Connectors</h2>

      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Pitch:</label>
          <select name="pitch">
            <option value="">All</option>
            {pitches.map((p) => (
              <option
                key={p.pitch_mm}
                value={p.pitch_mm ?? ""}
                selected={String(p.pitch_mm) === params.pitch}
              >
                {p.pitch_mm}mm
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Series:</label>
          <select name="series">
            <option value="">All</option>
            {seriesList.map((s) => (
              <option
                key={s.reference_series}
                value={s.reference_series ?? ""}
                selected={s.reference_series === params.series}
              >
                {s.reference_series}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Mounting:</label>
          <select name="is_smd">
            <option value="">All</option>
            <option
              value="true"
              selected={params.is_smd?.toString() === "true"}
            >
              SMD
            </option>
            <option
              value="false"
              selected={params.is_smd?.toString() === "false"}
            >
              Through-Hole
            </option>
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={connectors.map((c) => ({
          lcsc: c.lcsc,
          mfr: c.mfr,
          package: c.package,
          pitch: c.pitch_mm && (
            <span className="tabular-nums">{c.pitch_mm}mm</span>
          ),
          pins_wires: (
            <span className="tabular-nums">
              {c.num_rows && c.num_pins_per_row
                ? `${c.num_rows}×${c.num_pins_per_row}`
                : (c.num_pins_per_row ?? c.num_pins)}
              {c.num_pins ? ` (${c.num_pins})` : ""}
            </span>
          ),
          series: c.reference_series,
          gender: c.gender,
          mounting: c.mounting_style,
          is_smd: c.is_smd ? "Yes" : "No",
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB Wire to Board Connector Search",
  )
})
