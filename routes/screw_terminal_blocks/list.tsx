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
  }),
  jsonResponse: z.string().or(
    z.object({
      screw_terminal_blocks: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          pitch_mm: z.number().optional(),
          number_of_pins: z.number().optional(),
          current_rating_a: z.number().optional(),
          voltage_rating_v: z.number().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  let query = ctx.db
    .selectFrom("screw_terminal_block")
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

  const pitches = await ctx.db
    .selectFrom("screw_terminal_block")
    .select("pitch_mm")
    .distinct()
    .where("pitch_mm", "is not", null)
    .execute()

  const blocks = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      screw_terminal_blocks: blocks
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          pitch_mm: c.pitch_mm ?? undefined,
          number_of_pins: c.number_of_pins ?? undefined,
          current_rating_a: c.current_rating_a ?? undefined,
          voltage_rating_v: c.voltage_rating_v ?? undefined,
          stock: c.stock ?? undefined,
          price1: c.price1 ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0),
    })
  }

  return ctx.react(
    <div>
      <h2>Screw Terminal Blocks</h2>

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

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={blocks.map((c) => ({
          lcsc: c.lcsc,
          mfr: c.mfr,
          pitch: c.pitch_mm && (
            <span className="tabular-nums">{c.pitch_mm}mm</span>
          ),
          pins: <span className="tabular-nums">{c.number_of_pins}</span>,
          current: c.current_rating_a && (
            <span className="tabular-nums">{c.current_rating_a}A</span>
          ),
          voltage: c.voltage_rating_v && (
            <span className="tabular-nums">{c.voltage_rating_v}V</span>
          ),
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB Screw Terminal Block Search",
  )
})
