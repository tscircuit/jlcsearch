import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    channels: z.coerce.number().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  let query = ctx.db
    .selectFrom("analog_multiplexer")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")
    .where("num_channels", "<=", 2)

  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  if (req.query.channels) {
    query = query.where("num_channels", "=", req.query.channels)
  }

  const packages = await ctx.db
    .selectFrom("analog_multiplexer")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  const channels = await ctx.db
    .selectFrom("analog_multiplexer")
    .select("num_channels")
    .distinct()
    .orderBy("num_channels")
    .where("num_channels", "<=", 2)
    .execute()

  const switches = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      switches: switches.map((m) => ({
        lcsc: m.lcsc,
        mfr: m.mfr,
        package: m.package,
        num_channels: m.num_channels,
        on_resistance_ohms: m.on_resistance_ohms,
        supply_voltage_min: m.supply_voltage_min,
        supply_voltage_max: m.supply_voltage_max,
        has_spi: m.has_spi === 1,
        has_i2c: m.has_i2c === 1,
        has_parallel_interface: m.has_parallel_interface === 1,
        channel_type: m.channel_type,
        stock: m.stock,
        price1: m.price1,
      })),
    })
  }

  return ctx.react(
    <div>
      <h2>Analog Switches</h2>

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
        rows={switches.map((m) => ({
          lcsc: m.lcsc,
          mfr: m.mfr,
          package: m.package,
          channels: m.num_channels,
          on_resistance: m.on_resistance_ohms ? `${m.on_resistance_ohms}Ω` : "",
          voltage:
            m.supply_voltage_min && m.supply_voltage_max ? (
              <span className="tabular-nums">
                {m.supply_voltage_min}V - {m.supply_voltage_max}V
              </span>
            ) : (
              ""
            ),
          interface: [
            m.has_spi && "SPI",
            m.has_i2c && "I2C",
            m.has_parallel_interface && "Parallel",
          ]
            .filter(Boolean)
            .join(", "),
          type: m.channel_type !== "unknown" ? m.channel_type : "",
          stock: <span className="tabular-nums">{m.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(m.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB Analog Switch Search",
  )
})
