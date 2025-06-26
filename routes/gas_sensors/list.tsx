import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    sensor_type: z.string().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  let query = ctx.db
    .selectFrom("gas_sensor")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  if (req.query.sensor_type) {
    query = query.where("sensor_type", "=", req.query.sensor_type)
  }

  const packages = await ctx.db
    .selectFrom("gas_sensor")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  const types = await ctx.db
    .selectFrom("gas_sensor")
    .select("sensor_type")
    .distinct()
    .where("sensor_type", "is not", null)
    .orderBy("sensor_type")
    .execute()

  const sensors = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      gas_sensors: sensors
        .map((s) => ({
          lcsc: s.lcsc ?? 0,
          mfr: s.mfr ?? "",
          package: s.package ?? "",
          sensor_type: s.sensor_type ?? undefined,
          measures_air_quality: s.measures_air_quality === 1,
          measures_co2: s.measures_co2 === 1,
          measures_oxygen: s.measures_oxygen === 1,
          measures_carbon_monoxide: s.measures_carbon_monoxide === 1,
          measures_methane: s.measures_methane === 1,
          measures_nitrogen_oxides: s.measures_nitrogen_oxides === 1,
          measures_sulfur_hexafluoride: s.measures_sulfur_hexafluoride === 1,
          measures_volatile_organic_compounds:
            s.measures_volatile_organic_compounds === 1,
          measures_formaldehyde: s.measures_formaldehyde === 1,
          measures_hydrogen: s.measures_hydrogen === 1,
          measures_explosive_gases: s.measures_explosive_gases === 1,
          stock: s.stock ?? undefined,
          price1: s.price1 ?? undefined,
        }))
        .filter((s) => s.lcsc !== 0 && s.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>Gas Sensors</h2>

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
          <label>Type:</label>
          <select name="sensor_type">
            <option value="">All</option>
            {types.map((t) => (
              <option
                key={t.sensor_type}
                value={t.sensor_type ?? ""}
                selected={t.sensor_type === req.query.sensor_type}
              >
                {t.sensor_type}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={sensors.map((s) => ({
          lcsc: s.lcsc,
          mfr: s.mfr,
          package: s.package,
          sensor_type: s.sensor_type,
          stock: <span className="tabular-nums">{s.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(s.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB Gas Sensor Search",
  )
})
