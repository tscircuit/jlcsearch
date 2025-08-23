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
    contact_type: z.string().optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      fpc_connectors: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          pitch_mm: z.number().optional(),
          number_of_contacts: z.number().optional(),
          contact_type: z.string().optional(),
          locking_feature: z.string().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  let query = ctx.db
    .selectFrom("fpc_connector")
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

  if (params.contact_type) {
    query = query.where("contact_type", "=", params.contact_type)
  }

  const pitches = await ctx.db
    .selectFrom("fpc_connector")
    .select("pitch_mm")
    .distinct()
    .where("pitch_mm", "is not", null)
    .execute()

  const contactTypes = await ctx.db
    .selectFrom("fpc_connector")
    .select("contact_type")
    .distinct()
    .where("contact_type", "is not", null)
    .execute()

  const connectors = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      fpc_connectors: connectors
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          pitch_mm: c.pitch_mm ?? undefined,
          number_of_contacts: c.number_of_contacts ?? undefined,
          contact_type: c.contact_type ?? undefined,
          locking_feature: c.locking_feature ?? undefined,
          stock: c.stock ?? undefined,
          price1: c.price1 ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0),
    })
  }

  return ctx.react(
    <div>
      <h2>FPC Connectors</h2>

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
          <label>Contact Type:</label>
          <select name="contact_type">
            <option value="">All</option>
            {contactTypes.map((t) => (
              <option
                key={t.contact_type}
                value={t.contact_type ?? ""}
                selected={t.contact_type === params.contact_type}
              >
                {t.contact_type}
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
          pitch: c.pitch_mm && (
            <span className="tabular-nums">{c.pitch_mm}mm</span>
          ),
          contacts: (
            <span className="tabular-nums">{c.number_of_contacts}</span>
          ),
          contact_type: c.contact_type,
          locking: c.locking_feature,
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB FPC Connector Search",
  )
})
