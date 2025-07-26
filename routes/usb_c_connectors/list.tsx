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
    gender: z.enum(["Male", "Female"]).optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      usb_c_connectors: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          gender: z.string().optional(),
          number_of_contacts: z.number().optional(),
          current_rating_a: z.number().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  let query = ctx.db
    .selectFrom("usb_c_connector")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  const params = req.commonParams

  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  if (params.gender) {
    query = query.where("gender", "=", params.gender)
  }

  const packages = await ctx.db
    .selectFrom("usb_c_connector")
    .select("package")
    .distinct()
    .where("package", "is not", null)
    .execute()

  const connectors = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      usb_c_connectors: connectors
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          package: c.package ?? "",
          gender: c.gender ?? undefined,
          number_of_contacts: c.number_of_contacts ?? undefined,
          current_rating_a: c.current_rating_a ?? undefined,
          stock: c.stock ?? undefined,
          price1: c.price1 ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0 && c.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>USB-C Connectors</h2>

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
          <label>Gender:</label>
          <select name="gender">
            <option value="">All</option>
            <option value="Male" selected={params.gender === "Male"}>
              Male
            </option>
            <option value="Female" selected={params.gender === "Female"}>
              Female
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
          contacts: (
            <span className="tabular-nums">{c.number_of_contacts}</span>
          ),
          current: c.current_rating_a && (
            <span className="tabular-nums">{c.current_rating_a}A</span>
          ),
          gender: c.gender,
          stock: <span className="tabular-nums">{c.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(c.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB USB-C Connector Search",
  )
})
