import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  commonParams: z.object({
    json: z.boolean().optional(),
    relay_type: z.string().optional(),
    package: z.string().optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      relays: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          relay_type: z.string(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  const params = req.commonParams

  let query = ctx.db
    .selectFrom("relay")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  if (params.relay_type) {
    query = query.where("relay_type", "=", params.relay_type)
  }

  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  const types = await ctx.db
    .selectFrom("relay")
    .select("relay_type")
    .distinct()
    .execute()

  const packages = await ctx.db
    .selectFrom("relay")
    .select("package")
    .distinct()
    .where("package", "is not", null)
    .orderBy("package")
    .execute()

  const relays = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      relays: relays
        .map((r) => ({
          lcsc: r.lcsc ?? 0,
          mfr: r.mfr ?? "",
          package: r.package ?? "",
          relay_type: r.relay_type ?? "",
          stock: r.stock ?? undefined,
          price1: r.price1 ?? undefined,
        }))
        .filter((r) => r.lcsc !== 0 && r.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>Relays</h2>

      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Type:</label>
          <select name="relay_type">
            <option value="">All</option>
            {types.map((t) => (
              <option
                key={t.relay_type}
                value={t.relay_type ?? ""}
                selected={t.relay_type === params.relay_type}
              >
                {t.relay_type}
              </option>
            ))}
          </select>
        </div>

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

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={relays.map((r) => ({
          lcsc: r.lcsc,
          mfr: r.mfr,
          package: r.package,
          type: r.relay_type,
          stock: <span className="tabular-nums">{r.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(r.price1)}</span>,
        }))}
      />
    </div>,
  )
})
