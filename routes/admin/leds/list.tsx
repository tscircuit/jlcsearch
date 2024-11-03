import { Table } from "lib/admin/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    color: z.string().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("led")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  // Apply color filter
  if (req.query.color) {
    query = query.where("color", "=", req.query.color)
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
                selected={p.package === req.query.package}
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
                selected={c.color === req.query.color}
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
        }))}
      />
    </div>,
  )
})
