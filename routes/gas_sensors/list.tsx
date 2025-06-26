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
    measurement: z
      .enum([
        "",
        "air_quality",
        "co2",
        "oxygen",
        "carbon_monoxide",
        "methane",
        "nitrogen_oxides",
        "sulfur_hexafluoride",
        "volatile_organic_compounds",
        "formaldehyde",
        "hydrogen",
        "explosive_gases",
      ])
      .optional(),
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

  if (req.query.measurement) {
    switch (req.query.measurement) {
      case "air_quality":
        query = query.where("measures_air_quality", "=", 1)
        break
      case "co2":
        query = query.where("measures_co2", "=", 1)
        break
      case "oxygen":
        query = query.where("measures_oxygen", "=", 1)
        break
      case "carbon_monoxide":
        query = query.where("measures_carbon_monoxide", "=", 1)
        break
      case "methane":
        query = query.where("measures_methane", "=", 1)
        break
      case "nitrogen_oxides":
        query = query.where("measures_nitrogen_oxides", "=", 1)
        break
      case "sulfur_hexafluoride":
        query = query.where("measures_sulfur_hexafluoride", "=", 1)
        break
      case "volatile_organic_compounds":
        query = query.where("measures_volatile_organic_compounds", "=", 1)
        break
      case "formaldehyde":
        query = query.where("measures_formaldehyde", "=", 1)
        break
      case "hydrogen":
        query = query.where("measures_hydrogen", "=", 1)
        break
      case "explosive_gases":
        query = query.where("measures_explosive_gases", "=", 1)
        break
    }
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

        <div>
          <label>Measurement:</label>
          <select name="measurement">
            <option value="">All</option>
            <option
              value="air_quality"
              selected={req.query.measurement === "air_quality"}
            >
              Air Quality
            </option>
            <option value="co2" selected={req.query.measurement === "co2"}>
              CO₂
            </option>
            <option
              value="oxygen"
              selected={req.query.measurement === "oxygen"}
            >
              Oxygen
            </option>
            <option
              value="carbon_monoxide"
              selected={req.query.measurement === "carbon_monoxide"}
            >
              Carbon Monoxide
            </option>
            <option
              value="methane"
              selected={req.query.measurement === "methane"}
            >
              Methane
            </option>
            <option
              value="nitrogen_oxides"
              selected={req.query.measurement === "nitrogen_oxides"}
            >
              Nitrogen Oxides
            </option>
            <option
              value="sulfur_hexafluoride"
              selected={req.query.measurement === "sulfur_hexafluoride"}
            >
              Sulfur Hexafluoride
            </option>
            <option
              value="volatile_organic_compounds"
              selected={req.query.measurement === "volatile_organic_compounds"}
            >
              VOC
            </option>
            <option
              value="formaldehyde"
              selected={req.query.measurement === "formaldehyde"}
            >
              Formaldehyde
            </option>
            <option
              value="hydrogen"
              selected={req.query.measurement === "hydrogen"}
            >
              Hydrogen
            </option>
            <option
              value="explosive_gases"
              selected={req.query.measurement === "explosive_gases"}
            >
              Explosive Gases
            </option>
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
