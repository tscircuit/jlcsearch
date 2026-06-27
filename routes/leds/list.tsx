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
    color: z.string().optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      leds: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          color: z.string().optional(),
          wavelength_nm: z.number().optional(),
          forward_voltage: z.number().optional(),
          forward_current: z.number().optional(),
          luminous_intensity_mcd: z.number().optional(),
          stock: z.number().optional(),
          price1: z.number().optional(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  const params = req.commonParams

  // Start with base query
  let query = ctx.db
    .selectFrom("led")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  // Apply color filter
  if (params.color) {
    query = query.where("color", "=", params.color)
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("led")
    .select("package")
    .distinct()
    .execute()

  // Get unique colors for dropdown
  const colors = await ctx.db
    .selectFrom("led")
    .select("color")
    .distinct()
    .where("color", "is not", null)
    .execute()

  const leds = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      leds: leds
        .map((led) => ({
          lcsc: led.lcsc ?? 0,
          mfr: led.mfr ?? "",
          package: led.package ?? "",
          color: led.color ?? undefined,
          wavelength_nm: led.wavelength_nm ?? undefined,
          forward_voltage: led.forward_voltage ?? undefined,
          forward_current: led.forward_current ?? undefined,
          luminous_intensity_mcd: led.luminous_intensity_mcd ?? undefined,
          stock: led.stock ?? undefined,
          price1: led.price1 ?? undefined,
        }))
        .filter((led) => led.lcsc !== 0 && led.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>LEDs</h2>

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
          <label>Color:</label>
          <select name="color">
            <option value="">All</option>
            {colors.map((c) => (
              <option
                key={c.color}
                value={c.color ?? ""}
                selected={c.color === params.color}
              >
                {c.color}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={leds.map((led) => ({
          lcsc: led.lcsc,
          mfr: led.mfr,
          package: led.package,
          color: led.color,
          wavelength: led.wavelength_nm ? `${led.wavelength_nm}nm` : "",
          forward_voltage: led.forward_voltage ? `${led.forward_voltage}V` : "",
          forward_current: led.forward_current ? `${led.forward_current}A` : "",
          luminous_intensity: led.luminous_intensity_mcd
            ? `${led.luminous_intensity_mcd}mcd`
            : "",
          stock: <span className="tabular-nums">{led.stock}</span>,
          price: (
            <span className="tabular-nums">{formatPrice(led.price1)}</span>
          ),
        }))}
      />
    </div>,
  )
})
