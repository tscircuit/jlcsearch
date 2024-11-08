import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatSiUnit } from "lib/util/format-si-unit"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    resolution: z.coerce.number().optional(),
    interface: z.string().optional(),
    is_differential: z.boolean().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("adc")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply filters
  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  if (req.query.resolution) {
    query = query.where("resolution_bits", "=", req.query.resolution)
  }

  if (req.query.interface) {
    query = query.where("interface_type", "=", req.query.interface)
  }

  if (req.query.is_differential !== undefined) {
    query = query.where("is_differential", "=", req.query.is_differential)
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("adc")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  // Get unique resolutions for dropdown
  const resolutions = await ctx.db
    .selectFrom("adc")
    .select("resolution_bits")
    .distinct()
    .orderBy("resolution_bits")
    .where("resolution_bits", "is not", null)
    .execute()

  // Get unique interfaces for dropdown
  const interfaces = await ctx.db
    .selectFrom("adc")
    .select("interface_type")
    .distinct()
    .orderBy("interface_type")
    .where("interface_type", "is not", null)
    .execute()

  const adcs = await query.execute()

  return ctx.react(
    <div>
      <h2>Analog-to-Digital Converters</h2>

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
          <label>Resolution:</label>
          <select name="resolution">
            <option value="">All</option>
            {resolutions.map((r) => (
              <option
                key={r.resolution_bits}
                value={r.resolution_bits ?? ""}
                selected={r.resolution_bits === req.query.resolution}
              >
                {r.resolution_bits} bit
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Interface:</label>
          <select name="interface">
            <option value="">All</option>
            {interfaces.map((i) => (
              <option
                key={i.interface_type}
                value={i.interface_type ?? ""}
                selected={i.interface_type === req.query.interface}
              >
                {i.interface_type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Differential:</label>
          <select name="is_differential">
            <option value="">All</option>
            <option
              value="true"
              selected={req.query.is_differential === true}
            >
              Yes
            </option>
            <option
              value="false"
              selected={req.query.is_differential === false}
            >
              No
            </option>
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={adcs.map((adc) => ({
          lcsc: adc.lcsc,
          mfr: adc.mfr,
          package: adc.package,
          resolution: adc.resolution_bits ? `${adc.resolution_bits} bit` : "",
          sampling: adc.sampling_rate_hz ? (
            <span className="tabular-nums">
              {formatSiUnit(adc.sampling_rate_hz)}Hz
            </span>
          ) : "",
          channels: adc.num_channels,
          interface: adc.interface_type,
          differential: adc.is_differential ? "Yes" : "No",
          voltage: adc.supply_voltage_min && adc.supply_voltage_max ? (
            <span className="tabular-nums">
              {adc.supply_voltage_min}V - {adc.supply_voltage_max}V
            </span>
          ) : "",
          stock: <span className="tabular-nums">{adc.stock}</span>,
        }))}
      />
    </div>,
  )
})
