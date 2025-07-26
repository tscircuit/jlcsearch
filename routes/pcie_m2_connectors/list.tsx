import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  commonParams: z.object({
    json: z.boolean().optional(),
    key: z.string().optional(),
    is_right_angle: z.boolean().optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      pcie_m2_connectors: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          key: z.string().optional(),
          is_right_angle: z.boolean().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  let query = ctx.db
    .selectFrom("pcie_m2_connector")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  const params = req.commonParams

  if (params.key) {
    query = query.where("key", "=", params.key)
  }

  if (params.is_right_angle !== undefined) {
    query = query.where("is_right_angle", "=", params.is_right_angle ? 1 : 0)
  }

  const keys = await ctx.db
    .selectFrom("pcie_m2_connector")
    .select("key")
    .distinct()
    .where("key", "is not", null)
    .execute()

  const connectors = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      pcie_m2_connectors: connectors
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          key: c.key ?? undefined,
          is_right_angle: Boolean(c.is_right_angle),
          stock: c.stock ?? undefined,
          price1: c.price1 ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0),
    })
  }

  return ctx.react(
    <div>
      <h2>PCIe M.2 Connectors</h2>

      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Key:</label>
          <select name="key">
            <option value="">All</option>
            {keys.map((k) => (
              <option
                key={k.key}
                value={k.key ?? ""}
                selected={k.key === params.key}
              >
                {k.key}
              </option>
            ))}
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
        rows={connectors.map((c) => ({
          lcsc: c.lcsc,
          mfr: c.mfr,
          key: c.key,
          orientation: c.is_right_angle ? "Right Angle" : "Straight",
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB PCIe M.2 Connector Search",
  )
})
