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
    interface: z.enum(["spi", "i2c", "parallel", ""]).optional(),
    channel_type: z.enum(["single", "differential", ""]).optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("analog_multiplexer")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  // Apply channels filter
  if (req.query.channels) {
    query = query.where("num_channels", "=", req.query.channels)
  }

  // Apply interface filter
  if (req.query.interface) {
    switch (req.query.interface) {
      case "spi":
        query = query.where("has_spi", "=", true)
        break
      case "i2c":
        query = query.where("has_i2c", "=", true)
        break
      case "parallel":
        query = query.where("has_parallel_interface", "=", true)
        break
    }
  }

  // Apply channel type filter
  if (req.query.channel_type) {
    query = query.where("channel_type", "=", req.query.channel_type)
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("analog_multiplexer")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  // Get unique channel counts for dropdown
  const channels = await ctx.db
    .selectFrom("analog_multiplexer")
    .select("num_channels")
    .distinct()
    .orderBy("num_channels")
    .where("num_channels", "is not", null)
    .execute()

  const multiplexers = await query.execute()

  return ctx.react(
    <div>
      <h2>Analog Multiplexers</h2>

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
          </select>
        </div>

        <div>
          <label>Channel Type:</label>
          <select name="channel_type">
            <option value="">All</option>
            <option
              value="single"
              selected={req.query.channel_type === "single"}
            >
              Single-Ended
            </option>
            <option
              value="differential"
              selected={req.query.channel_type === "differential"}
            >
              Differential
            </option>
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={multiplexers.map((m) => ({
          lcsc: m.lcsc,
          mfr: m.mfr,
          package: m.package,
          channels: m.num_channels,
          on_resistance: m.on_resistance_ohms ? `${m.on_resistance_ohms}Ω` : "",
          voltage: m.supply_voltage_min && m.supply_voltage_max ? (
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
  )
})
