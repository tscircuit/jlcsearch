import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  commonParams: z.object({
    json: z.boolean().optional(),
    switch_type: z.string().optional(),
    circuit: z.string().optional(),
    pin_count: z.coerce.number().optional(),
    package: z.string().optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      switches: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          switch_type: z.string(),
          circuit: z.string().optional(),
          pin_count: z.number().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  const params = req.commonParams

  let query = ctx.db
    .selectFrom("switch")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  if (params.switch_type) {
    query = query.where("switch_type", "=", params.switch_type)
  }

  if (params.circuit) {
    query = query.where("circuit", "=", params.circuit)
  }

  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  if (params.pin_count) {
    query = query.where("pin_count", "=", params.pin_count)
  }

  const types = await ctx.db
    .selectFrom("switch")
    .select("switch_type")
    .distinct()
    .execute()

  const circuits = await ctx.db
    .selectFrom("switch")
    .select("circuit")
    .distinct()
    .where("circuit", "is not", null)
    .execute()

  const packages = await ctx.db
    .selectFrom("switch")
    .select("package")
    .distinct()
    .where("package", "is not", null)
    .orderBy("package")
    .execute()

  const pinCounts = await ctx.db
    .selectFrom("switch")
    .select("pin_count")
    .distinct()
    .where("pin_count", "is not", null)
    .orderBy("pin_count")
    .execute()

  const switches = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      switches: switches
        .map((s) => ({
          lcsc: s.lcsc ?? 0,
          mfr: s.mfr ?? "",
          package: s.package ?? "",
          pin_count: s.pin_count ?? undefined,
          switch_type: s.switch_type ?? "",
          circuit: s.circuit ?? undefined,
          stock: s.stock ?? undefined,
          price1: s.price1 ?? undefined,
        }))
        .filter((s) => s.lcsc !== 0 && s.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>Switches</h2>

      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Type:</label>
          <select name="switch_type">
            <option value="">All</option>
            {types.map((t) => (
              <option
                key={t.switch_type}
                value={t.switch_type ?? ""}
                selected={t.switch_type === params.switch_type}
              >
                {t.switch_type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Circuit:</label>
          <select name="circuit">
            <option value="">All</option>
            {circuits.map((c) => (
              <option
                key={c.circuit}
                value={c.circuit ?? ""}
                selected={c.circuit === params.circuit}
              >
                {c.circuit}
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

        <div>
          <label>Pin Count:</label>
          <select name="pin_count">
            <option value="">All</option>
            {pinCounts.map((p) => (
              <option
                key={p.pin_count}
                value={p.pin_count?.toString() ?? ""}
                selected={p.pin_count === params.pin_count}
              >
                {p.pin_count}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={switches.map((s) => ({
          lcsc: s.lcsc,
          mfr: s.mfr,
          package: s.package,
          type: s.switch_type,
          pins: s.pin_count,
          circuit: s.circuit ?? "",
          stock: <span className="tabular-nums">{s.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(s.price1)}</span>,
        }))}
      />
    </div>,
  )
})
