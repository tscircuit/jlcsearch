import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { formatSiUnit } from "lib/util/format-si-unit"
import { formatPrice } from "lib/util/format-price"

const TOPOLOGY_LABELS: Record<string, string> = {
  isolated: "Isolated",
  bussed: "Bussed",
  dual_terminated: "Dual Terminated",
  unknown: "Unknown",
}

const formatTemperatureCoefficient = (value?: number | null) => {
  if (value == null) return ""
  return `${value} ppm/°C`
}

const normalizeTopologyParam = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined
  return value ? value : undefined
}

const parseNumberParam = (value: unknown): number | undefined => {
  if (typeof value === "number") return value
  if (typeof value !== "string") return undefined
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
    number_of_resistors: z
      .unknown()
      .optional()
      .transform((val) => parseNumberParam(val)),
    topology: z
      .unknown()
      .optional()
      .transform((val) => normalizeTopologyParam(val)),
    is_basic: z.boolean().optional(),
    is_preferred: z.boolean().optional(),
    resistance: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return undefined
        const valWithUnit = `${val}Ω`
        const parsed = parseAndConvertSiUnit(valWithUnit)
        return parsed.value
      }),
  }),
  jsonResponse: z.string().or(
    z.object({
      resistor_arrays: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          is_basic: z.boolean(),
          is_preferred: z.boolean(),
          number_of_resistors: z.number().nullable(),
          number_of_pins: z.number().nullable(),
          topology: z.string().nullable(),
          resistance: z.number().nullable(),
          tolerance_fraction: z.number().nullable(),
          power_watts: z.number().nullable(),
          temperature_coefficient_ppm: z.number().nullable(),
          stock: z.number().nullable(),
          price1: z.number().nullable(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  let query = ctx.db
    .selectFrom("resistor_array")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  const params = req.commonParams

  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  if (params.is_basic) {
    query = query.where("is_basic", "=", 1)
  }
  if (params.is_preferred) {
    query = query.where("is_preferred", "=", 1)
  }

  if (params.number_of_resistors != null) {
    query = query.where("number_of_resistors", "=", params.number_of_resistors)
  }

  if (params.topology) {
    query = query.where("topology", "=", params.topology)
  }

  if (params.resistance != null) {
    const delta = params.resistance * 0.0001
    query = query
      .where("resistance", ">=", params.resistance - delta)
      .where("resistance", "<=", params.resistance + delta)
  }

  const packages = await ctx.db
    .selectFrom("resistor_array")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  const resistorCounts = await ctx.db
    .selectFrom("resistor_array")
    .select("number_of_resistors")
    .distinct()
    .where("number_of_resistors", "is not", null)
    .orderBy("number_of_resistors")
    .execute()

  const topologies = await ctx.db
    .selectFrom("resistor_array")
    .select("topology")
    .distinct()
    .where("topology", "is not", null)
    .orderBy("topology")
    .execute()

  const resistorArrays = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      resistor_arrays: resistorArrays.map((array) => ({
        lcsc: array.lcsc ?? 0,
        mfr: array.mfr ?? "",
        package: array.package ?? "",
        is_basic: Boolean(array.is_basic),
        is_preferred: Boolean(array.is_preferred),
        number_of_resistors: array.number_of_resistors ?? null,
        number_of_pins: array.number_of_pins ?? null,
        topology: array.topology ?? null,
        resistance: array.resistance ?? null,
        tolerance_fraction: array.tolerance_fraction ?? null,
        power_watts: array.power_watts ?? null,
        temperature_coefficient_ppm: array.temperature_coefficient_ppm ?? null,
        stock: array.stock ?? null,
        price1: array.price1 ?? null,
      })),
    })
  }

  return ctx.react(
    <div>
      <h2>Resistor Arrays</h2>

      <form method="GET" className="flex flex-row flex-wrap gap-4">
        <div>
          <label>Package:</label>
          <select name="package">
            <option value="">All</option>
            {packages.map((p) => (
              <option
                key={p.package ?? "unknown"}
                value={p.package ?? ""}
                selected={p.package === params.package}
              >
                {p.package}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Resistors:</label>
          <select name="number_of_resistors">
            <option value="">All</option>
            {resistorCounts.map((count) => (
              <option
                key={count.number_of_resistors ?? "unknown"}
                value={count.number_of_resistors ?? ""}
                selected={
                  count.number_of_resistors === params.number_of_resistors
                }
              >
                {count.number_of_resistors}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Topology:</label>
          <select name="topology">
            <option value="">All</option>
            {topologies.map((t) => (
              <option
                key={t.topology ?? "unknown"}
                value={t.topology ?? ""}
                selected={t.topology === params.topology}
              >
                {t.topology ? (TOPOLOGY_LABELS[t.topology] ?? t.topology) : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>
            Basic Part:
            <input
              type="checkbox"
              name="is_basic"
              value="true"
              checked={params.is_basic}
            />
          </label>
        </div>

        <div>
          <label>
            Preferred Part:
            <input
              type="checkbox"
              name="is_preferred"
              value="true"
              checked={params.is_preferred}
            />
          </label>
        </div>

        <div>
          <label>Resistance:</label>
          <input
            type="text"
            name="resistance"
            placeholder="e.g. 1kΩ"
            defaultValue={formatSiUnit(params.resistance)}
          />
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={resistorArrays.map((array) => ({
          lcsc: array.lcsc,
          mfr: array.mfr,
          package: array.package,
          is_basic: array.is_basic ? "✓" : "",
          is_preferred: array.is_preferred ? "✓" : "",
          resistors: array.number_of_resistors,
          pins: array.number_of_pins,
          topology: array.topology
            ? (TOPOLOGY_LABELS[array.topology] ?? array.topology)
            : "",
          resistance: (
            <span className="tabular-nums">
              {formatSiUnit(array.resistance)}Ω
            </span>
          ),
          tolerance: (
            <span className="tabular-nums">
              {array.tolerance_fraction
                ? `±${array.tolerance_fraction * 100}%`
                : ""}
            </span>
          ),
          power: (
            <span className="tabular-nums">
              {formatSiUnit(array.power_watts)}W
            </span>
          ),
          tempco: (
            <span className="tabular-nums">
              {formatTemperatureCoefficient(array.temperature_coefficient_ppm)}
            </span>
          ),
          stock: <span className="tabular-nums">{array.stock}</span>,
          price: (
            <span className="tabular-nums">{formatPrice(array.price1)}</span>
          ),
        }))}
      />
    </div>,
  )
})
