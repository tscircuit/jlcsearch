import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
    current_gain_min: z.coerce.number().optional(),
    collector_current_min: z.coerce.number().optional(),
    collector_emitter_voltage_min: z.coerce.number().optional(),
    transition_frequency_min: z.coerce.number().optional(),
    power_min: z.coerce.number().optional(),
    temperature_range: z.string().optional(),
    mfr: z.string().optional(),
    search: z.string().optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      bjt_transistors: z.array(
        z.object({
          lcsc: z.number(),
          mfr: z.string(),
          description: z.string(),
          stock: z.number(),
          price1: z.number().nullable(),
          in_stock: z.boolean(),
          package: z.string(),
          current_gain: z.number().nullable(),
          collector_current: z.number(),
          collector_emitter_voltage: z.number().nullable(),
          transition_frequency: z.number().nullable(),
          power: z.number().nullable(),
          temperature_range: z.string().nullable(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  let query = ctx.db
    .selectFrom("bjt_transistor")
    .selectAll()
    .orderBy("stock", "desc")
    .limit(100)

  // Add filters for each column
  if (params.package) {
    query = query.where("package", "=", params.package)
  }
  if (params.current_gain_min) {
    query = query.where("current_gain", ">=", params.current_gain_min)
  }
  if (params.collector_current_min) {
    query = query.where("collector_current", ">=", params.collector_current_min)
  }
  if (params.collector_emitter_voltage_min) {
    query = query.where(
      "collector_emitter_voltage",
      ">=",
      params.collector_emitter_voltage_min,
    )
  }
  if (params.transition_frequency_min) {
    query = query.where(
      "transition_frequency",
      ">=",
      params.transition_frequency_min,
    )
  }
  if (params.power_min) {
    query = query.where("power", ">=", params.power_min)
  }
  if (params.temperature_range) {
    query = query.where(
      "temperature_range",
      "like",
      `%${params.temperature_range}%`,
    )
  }
  if (params.mfr) {
    query = query.where("mfr", "like", `%${params.mfr}%`)
  }
  if (params.search) {
    query = query.where("description", "like", `%${params.search}%`)
  }

  const components = await query.execute()
  // Map and transform the components data with proper type assertions
  const fullComponents = components.map(
    (c) =>
      ({
        lcsc: c.lcsc ?? 0,
        mfr: c.mfr || "",
        package: c.package || "",
        current_gain: c.current_gain,
        collector_current: c.collector_current ?? 0,
        collector_emitter_voltage: c.collector_emitter_voltage,
        transition_frequency: c.transition_frequency,
        power: c.power,
        temperature_range: c.temperature_range,
        description: c.description || "",
        stock: c.stock ?? 0,
        price1: c.price1,
        in_stock: (c.stock ?? 0) > 0,
        attributes: {},
      }) as const,
  ) as unknown as Array<{
    lcsc: number
    mfr: string
    package: string
    current_gain: number | null
    collector_current: number
    collector_emitter_voltage: number | null
    transition_frequency: number | null
    power: number | null
    temperature_range: string | null
    description: string
    stock: number
    price1: number | null
    in_stock: boolean
    attributes: Record<string, string>
  }>

  if (ctx.isApiRequest) {
    return ctx.json({
      bjt_transistors: components.map((c) => ({
        lcsc: Number(c.lcsc),
        mfr: String(c.mfr || ""),
        description: String(c.description || ""),
        stock: Number(c.stock || 0),
        price1: c.price1,
        in_stock: Boolean((c.stock || 0) > 0),
        package: String(c.package || ""),
        current_gain: c.current_gain,
        collector_current: c.collector_current ?? 0,
        collector_emitter_voltage: c.collector_emitter_voltage,
        transition_frequency: c.transition_frequency,
        power: c.power,
        temperature_range: c.temperature_range,
      })),
    })
  }

  return ctx.react(
    <div>
      <h2>Bipolar Transistors (BJT)</h2>
      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Package:</label>
          <select name="package" className="border px-2 py-1 rounded">
            <option value="">All</option>
            {fullComponents.map((c) => (
              <option key={c.package} value={c.package ?? ""}>
                {c.package}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Min Current Gain:</label>
          <input
            type="number"
            name="current_gain_min"
            className="border px-2 py-1 rounded"
          />
        </div>
        <div>
          <label>Min Collector Current (mA):</label>
          <input
            type="number"
            name="collector_current_min"
            className="border px-2 py-1 rounded"
          />
        </div>
        <div>
          <label>Min Vce (V):</label>
          <input
            type="number"
            name="collector_emitter_voltage_min"
            className="border px-2 py-1 rounded"
          />
        </div>
      </form>
      <Table
        rows={components.map((c) => ({
          LCSC: c.lcsc ? (
            <a
              href={`https://jlcpcv.com/partdetail/${c.mfr}/C${c.lcsc}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {c.lcsc}
            </a>
          ) : null,
          MFR: c.mfr || null,
          Package: c.package || null,
          "Current Gain (hFE)": c.current_gain ? (
            <span className="tabular-nums">{c.current_gain}</span>
          ) : null,
          "Collector Current (A)": c.collector_current ? (
            <span className="tabular-nums">{c.collector_current}A</span>
          ) : null,
          "Collector-Emitter Voltage (V)": c.collector_emitter_voltage ? (
            <span className="tabular-nums">{c.collector_emitter_voltage}V</span>
          ) : null,
          "Transition Frequency (MHz)": c.transition_frequency ? (
            <span className="tabular-nums">
              {(c.transition_frequency / 1e6).toFixed(1)}
            </span>
          ) : null,
          "Power (W)": c.power ? (
            <span className="tabular-nums">{c.power}W</span>
          ) : null,
          "Temperature Range": c.temperature_range || null,
          Description: c.description || null,
          Stock: <span className="tabular-nums">{c.stock}</span>,
          "Price (1pc)": c.price1 ? (
            <span className="tabular-nums">{formatPrice(c.price1)}</span>
          ) : null,
        }))}
      />
    </div>,
    "Bipolar Transistors (BJT)",
  )
})
