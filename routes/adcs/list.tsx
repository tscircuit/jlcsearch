import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatSiUnit } from "lib/util/format-si-unit"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    resolution: z.coerce.number().optional(),
    interface: z
      .enum(["spi", "i2c", "parallel", "serial", "uart", ""])
      .optional(),
    is_differential: z.boolean().optional(),
    channels: z.coerce.number().optional(),
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
      case "spi":
        query = query.where("has_spi", "=", 1)
        break
      case "i2c":
        query = query.where("has_i2c", "=", 1)
        break
      case "parallel":
        query = query.where("has_parallel_interface", "=", 1)
        break
      case "serial":
        query = query.where("has_serial_interface", "=", 1)
        break
      case "uart":
        query = query.where("has_uart", "=", 1)
        break
    }
  }

  if (req.query.is_differential !== undefined) {
    query = query.where(
      "is_differential",
      "=",
      req.query.is_differential ? 1 : 0,
    )
  }

  if (req.query.channels) {
    query = query.where("num_channels", "=", req.query.channels)
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

  // Get unique channel counts for dropdown
  const channels = await ctx.db
    .selectFrom("adc")
    .select("num_channels")
    .distinct()
    .orderBy("num_channels")
    .where("num_channels", "is not", null)
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
            <option value="spi" selected={req.query.interface === "spi"}>
              SPI
            </option>
            <option value="i2c" selected={req.query.interface === "i2c"}>
              I2C
            </option>
            <option
              value="parallel"
              selected={req.query.interface === "parallel"}
            >
              Parallel
            </option>
            <option value="serial" selected={req.query.interface === "serial"}>
              Serial
            </option>
            <option value="uart" selected={req.query.interface === "uart"}>
              UART
            </option>
          </select>
        </div>

        <div>
          <label>Differential:</label>
          <select name="is_differential">
            <option value="">All</option>
            <option value="true" selected={req.query.is_differential === true}>
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

        <div>
          <label>Channels:</label>
          <select name="channels">
            <option value="">All</option>
            {channels.map((c) => (
              <option
                key={c.num_channels}
                value={c.num_channels ?? ""}
                selected={c.num_channels === req.query.channels}
              >
                {c.num_channels}
              </option>
            ))}
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
          ) : (
            ""
          ),
          channels: adc.num_channels,
          interface: [
            adc.has_spi && "SPI",
            adc.has_i2c && "I2C",
            adc.has_parallel_interface && "Parallel",
            adc.has_serial_interface && "Serial",
            adc.has_uart && "UART",
          ]
            .filter(Boolean)
            .join(", "),
          differential: adc.is_differential ? "Yes" : "No",
          voltage:
            adc.supply_voltage_min && adc.supply_voltage_max ? (
              <span className="tabular-nums">
                {adc.supply_voltage_min}V - {adc.supply_voltage_max}V
              </span>
            ) : (
              ""
            ),
          stock: <span className="tabular-nums">{adc.stock}</span>,
          price: (
            <span className="tabular-nums">{formatPrice(adc.price1)}</span>
          ),
        }))}
      />
    </div>,
  )
})
