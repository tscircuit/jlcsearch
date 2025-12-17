import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
    connector_type: z.string().optional(),
    battery_type: z.string().optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      battery_holders: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          connector_type: z.string().optional(),
          battery_type: z.string().optional(),
          operating_temp_min: z.number().optional(),
          operating_temp_max: z.number().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  let query = ctx.db
    .selectFrom("battery_holder")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  const params = req.commonParams

  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  if (params.connector_type) {
    query = query.where("connector_type", "=", params.connector_type)
  }

  if (params.battery_type) {
    query = query.where("battery_type", "=", params.battery_type)
  }

  const [packages, connectorTypes, batteryTypes] = await Promise.all([
    ctx.db
      .selectFrom("battery_holder")
      .select("package")
      .distinct()
      .where("package", "is not", null)
      .execute(),
    ctx.db
      .selectFrom("battery_holder")
      .select("connector_type")
      .distinct()
      .where("connector_type", "is not", null)
      .execute(),
    ctx.db
      .selectFrom("battery_holder")
      .select("battery_type")
      .distinct()
      .where("battery_type", "is not", null)
      .execute(),
  ])

  const holders = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      battery_holders: holders
        .map((h) => ({
          lcsc: h.lcsc ?? 0,
          mfr: h.mfr ?? "",
          package: h.package ?? "",
          connector_type: h.connector_type ?? undefined,
          battery_type: h.battery_type ?? undefined,
          operating_temp_min: h.operating_temp_min ?? undefined,
          operating_temp_max: h.operating_temp_max ?? undefined,
          stock: h.stock ?? undefined,
          price1: h.price1 ?? undefined,
        }))
        .filter((h) => h.lcsc !== 0 && h.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>Battery Holders</h2>

      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Package:</label>
          <select name="package">
            <option value="">All</option>
            {packages.map((p) => (
              <option
                key={p.package}
                value={p.package ?? ""}
                selected={p.package === params.package}
              >
                {p.package}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Connector Type:</label>
          <select name="connector_type">
            <option value="">All</option>
            {connectorTypes.map((c) => (
              <option
                key={c.connector_type}
                value={c.connector_type ?? ""}
                selected={c.connector_type === params.connector_type}
              >
                {c.connector_type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Battery Type:</label>
          <select name="battery_type">
            <option value="">All</option>
            {batteryTypes.map((b) => (
              <option
                key={b.battery_type}
                value={b.battery_type ?? ""}
                selected={b.battery_type === params.battery_type}
              >
                {b.battery_type}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={holders.map((h) => ({
          lcsc: h.lcsc,
          mfr: h.mfr,
          package: h.package,
          connector: h.connector_type,
          battery: h.battery_type,
          temp_range:
            h.operating_temp_min != null && h.operating_temp_max != null ? (
              <span className="tabular-nums">
                {h.operating_temp_min}℃~{h.operating_temp_max}℃
              </span>
            ) : null,
          stock: <span className="tabular-nums">{h.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(h.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB Battery Holder Search",
  )
})
