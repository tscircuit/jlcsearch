import { Table } from "lib/ui/Table"
import { formatPrice } from "lib/util/format-price"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  commonParams: z.object({
    json: z.boolean().optional(),
    pitch: z
      .union([z.literal(""), z.coerce.number()])
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
    pins: z
      .union([z.literal(""), z.coerce.number().int()])
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      spring_clamp_terminal_blocks: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          pitch_mm: z.number().optional(),
          num_pins: z.number().int().optional(),
          voltage_rating: z.number().optional(),
          current_rating: z.number().optional(),
          wire_gauge_mm2: z.number().optional(),
          wire_gauge_awg: z.string().optional(),
          mounting_style: z.string().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  let query = ctx.db
    .selectFrom("spring_clamp_terminal_block")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  if (params.pitch !== undefined) {
    query = query.where("pitch_mm", "=", params.pitch)
  }
  if (params.pins !== undefined) {
    query = query.where("num_pins", "=", params.pins)
  }

  const [blocks, pitches, pinCounts] = await Promise.all([
    query.execute(),
    ctx.db
      .selectFrom("spring_clamp_terminal_block")
      .select("pitch_mm")
      .distinct()
      .where("pitch_mm", "is not", null)
      .orderBy("pitch_mm")
      .execute(),
    ctx.db
      .selectFrom("spring_clamp_terminal_block")
      .select("num_pins")
      .distinct()
      .where("num_pins", "is not", null)
      .orderBy("num_pins")
      .execute(),
  ])

  if (ctx.isApiRequest) {
    return ctx.json({
      spring_clamp_terminal_blocks: blocks.map((block) => ({
        lcsc: block.lcsc ?? 0,
        mfr: block.mfr ?? "",
        package: block.package ?? "",
        pitch_mm: block.pitch_mm ?? undefined,
        num_pins: block.num_pins ?? undefined,
        voltage_rating: block.voltage_rating ?? undefined,
        current_rating: block.current_rating ?? undefined,
        wire_gauge_mm2: block.wire_gauge_mm2 ?? undefined,
        wire_gauge_awg: block.wire_gauge_awg ?? undefined,
        mounting_style: block.mounting_style ?? undefined,
        stock: block.stock ?? undefined,
        price1: block.price1 ?? undefined,
      })),
    })
  }

  return ctx.react(
    <div>
      <h2>Spring Clamp Terminal Blocks</h2>

      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Pitch:</label>
          <select name="pitch">
            <option value="">All</option>
            {pitches.map(({ pitch_mm }) => (
              <option
                key={pitch_mm}
                value={pitch_mm ?? ""}
                selected={pitch_mm === params.pitch}
              >
                {pitch_mm}mm
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Pins:</label>
          <select name="pins">
            <option value="">All</option>
            {pinCounts.map(({ num_pins }) => (
              <option
                key={num_pins}
                value={num_pins ?? ""}
                selected={num_pins === params.pins}
              >
                {num_pins}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={blocks.map((block) => ({
          lcsc: block.lcsc,
          mfr: block.mfr,
          package: block.package,
          pitch: block.pitch_mm && `${block.pitch_mm}mm`,
          pins: block.num_pins,
          voltage: block.voltage_rating && `${block.voltage_rating}V`,
          current: block.current_rating && `${block.current_rating}A`,
          wire_gauge: [
            block.wire_gauge_mm2 && `${block.wire_gauge_mm2}mm²`,
            block.wire_gauge_awg && `${block.wire_gauge_awg} AWG`,
          ]
            .filter(Boolean)
            .join(" / "),
          mounting: block.mounting_style,
          stock: <span className="tabular-nums">{block.stock}</span>,
          price: (
            <span className="tabular-nums">{formatPrice(block.price1)}</span>
          ),
        }))}
      />
    </div>,
    "JLCPCB Spring Clamp Terminal Block Search",
  )
})
