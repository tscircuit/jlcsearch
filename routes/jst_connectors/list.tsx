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
    series: z.string().optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      jst_connectors: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string().optional(),
          pitch_mm: z.number().optional(),
          num_rows: z.number().optional(),
          num_pins: z.number().optional(),
          reference_series: z.string().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  let query = ctx.db
    .selectFrom("jst_connector")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  const params = req.commonParams

  if (params.pitch) {
    const p = Number(params.pitch)
    if (!isNaN(p)) {
      query = query.where("pitch_mm", "=", p)
    }
  }

  if (params.series) {
    query = query.where("reference_series", "=", params.series)
  }

  const pitches = await ctx.db
    .selectFrom("jst_connector")
    .select("pitch_mm")
    .distinct()
    .where("pitch_mm", "is not", null)
    .execute()

  const seriesList = await ctx.db
    .selectFrom("jst_connector")
    .select("reference_series")
    .distinct()
    .where("reference_series", "is not", null)
    .execute()

  const connectors = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      jst_connectors: connectors
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          package: c.package ?? undefined,
          pitch_mm: c.pitch_mm ?? undefined,
          num_rows: c.num_rows ?? undefined,
          num_pins: c.num_pins ?? undefined,
          reference_series: c.reference_series ?? undefined,
          stock: c.stock ?? undefined,
          price1: c.price1 ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0),
    })
  }

  return ctx.react(
    <div>
      <h2>JST Connectors</h2>

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
          pins: <span className="tabular-nums">{c.num_pins}</span>,
          series: c.reference_series,
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB JST Connector Search",
  )
})
