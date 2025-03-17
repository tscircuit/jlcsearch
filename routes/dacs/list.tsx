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
    resolution: z.coerce.number().optional(),
    interface: z.enum(["spi", "i2c", "parallel", ""]).optional(),
    channels: z.coerce.number().optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      dacs: z.array(
        z.object({
          lcsc: z.number().int(),
          mfr: z.string(),
          package: z.string(),
          resolution_bits: z.number().optional(),
          num_channels: z.number().optional(),
          settling_time_us: z.number().optional(),
          supply_voltage_min: z.number().optional(),
          supply_voltage_max: z.number().optional(),
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
    .selectFrom("dac")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  // Apply resolution filter
  if (params.resolution) {
    query = query.where("resolution_bits", "=", params.resolution)
  }

  // Apply interface filter
  if (params.interface) {
    switch (params.interface) {
      case "spi":
        query = query.where("has_spi", "=", 1)
        break
      case "i2c":
        query = query.where("has_i2c", "=", 1)
        break
      case "parallel":
        query = query.where("has_parallel_interface", "=", 1)
        break
    }
  }

  // Apply channels filter
  if (params.channels) {
    query = query.where("num_channels", "=", params.channels)
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("dac")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  // Get unique resolutions for dropdown
  const resolutions = await ctx.db
    .selectFrom("dac")
    .select("resolution_bits")
    .distinct()
    .orderBy("resolution_bits")
    .where("resolution_bits", "is not", null)
    .execute()

  // Get unique channel counts for dropdown
  const channels = await ctx.db
    .selectFrom("dac")
    .select("num_channels")
    .distinct()
    .orderBy("num_channels")
    .where("num_channels", "is not", null)
    .execute()

  const dacs = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      dacs: dacs
        .map((d) => ({
          lcsc: d.lcsc ?? 0,
          mfr: d.mfr ?? "",
          package: d.package ?? "",
          resolution_bits: d.resolution_bits ?? undefined,
          num_channels: d.num_channels ?? undefined,
          settling_time_us: d.settling_time_us ?? undefined,
          supply_voltage_min: d.supply_voltage_min ?? undefined,
          supply_voltage_max: d.supply_voltage_max ?? undefined,
          stock: d.stock ?? undefined,
          price1: d.price1 ?? undefined,
        }))
        .filter((d) => d.lcsc !== 0 && d.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>Digital-to-Analog Converters</h2>

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
          <label>Resolution:</label>
          <select name="resolution">
            <option value="">All</option>
            {resolutions.map((r) => (
              <option
                key={r.resolution_bits}
                value={r.resolution_bits ?? ""}
                selected={r.resolution_bits === params.resolution}
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
            <option value="spi" selected={params.interface === "spi"}>
              SPI
            </option>
            <option value="i2c" selected={params.interface === "i2c"}>
              I²C
            </option>
            <option value="parallel" selected={params.interface === "parallel"}>
              Parallel
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
                selected={c.num_channels === params.channels}
              >
                {c.num_channels}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={dacs.map((dac) => ({
          lcsc: dac.lcsc,
          mfr: dac.mfr,
          package: dac.package,
          resolution: dac.resolution_bits ? `${dac.resolution_bits} bit` : "",
          channels: dac.num_channels,
          settling: dac.settling_time_us ? `${dac.settling_time_us}µs` : "",
          voltage:
            dac.supply_voltage_min && dac.supply_voltage_max ? (
              <span className="tabular-nums">
                {dac.supply_voltage_min}V - {dac.supply_voltage_max}V
              </span>
            ) : (
              ""
            ),
          interface: [
            dac.has_spi && "SPI",
            dac.has_i2c && "I²C",
            dac.has_parallel_interface && "Parallel",
          ]
            .filter(Boolean)
            .join(", "),
          output: dac.output_type,
          nonlinearity: dac.nonlinearity_lsb
            ? `±${dac.nonlinearity_lsb} LSB`
            : "",
          stock: <span className="tabular-nums">{dac.stock}</span>,
          price: (
            <span className="tabular-nums">{formatPrice(dac.price1)}</span>
          ),
        }))}
      />
    </div>,
    "JLCPCB DAC Search",
  )
})
