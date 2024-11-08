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
    interface: z.enum(['spi', 'i2c', 'parallel', 'serial', 'uart']).optional(),
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
    switch (req.query.interface) {
      case 'spi':
        query = query.where("has_spi", "=", true)
        break
      case 'i2c':
        query = query.where("has_i2c", "=", true)
        break
      case 'parallel':
        query = query.where("has_parallel_interface", "=", true)
        break
      case 'serial':
        query = query.where("has_serial_interface", "=", true)
        break
      case 'uart':
        query = query.where("has_uart", "=", true)
        break
    }
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
            <option value="spi" selected={req.query.interface === 'spi'}>SPI</option>
            <option value="i2c" selected={req.query.interface === 'i2c'}>I2C</option>
            <option value="parallel" selected={req.query.interface === 'parallel'}>Parallel</option>
            <option value="serial" selected={req.query.interface === 'serial'}>Serial</option>
            <option value="uart" selected={req.query.interface === 'uart'}>UART</option>
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
          interface: [
            adc.has_spi && "SPI",
            adc.has_i2c && "I2C",
            adc.has_parallel_interface && "Parallel",
            adc.has_serial_interface && "Serial",
            adc.has_uart && "UART"
          ].filter(Boolean).join(", "),
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
