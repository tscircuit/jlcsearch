import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"
import { formatSiUnit } from "lib/util/format-si-unit"
import { withIsApiRequest } from "lib/middlewares/with-is-api-request"

const spec = {
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    num_gpios: z.coerce.number().optional(),
    interface: z.enum(["spi", "i2c", "smbus", ""]).optional(),
    has_interrupt: z.boolean().optional(),
  }),
  jsonResponse: z.any(),
} as const

const route = async (req: any, ctx: any) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("io_expander")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  // Apply GPIO count filter
  if (req.query.num_gpios) {
    query = query.where("num_gpios", "=", req.query.num_gpios)
  }

  // Apply interface filter
  if (req.query.interface) {
    switch (req.query.interface) {
      case "spi":
        query = query.where("has_spi", "=", 1)
        break
      case "i2c":
        query = query.where("has_i2c", "=", 1)
        break
      case "smbus":
        query = query.where("has_smbus", "=", 1)
        break
    }
  }

  // Apply interrupt filter
  if (req.query.has_interrupt !== undefined) {
    query = query.where("has_interrupt", "=", req.query.has_interrupt ? 1 : 0)
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("io_expander")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  // Get unique GPIO counts for dropdown
  const gpioCounts = await ctx.db
    .selectFrom("io_expander")
    .select("num_gpios")
    .distinct()
    .orderBy("num_gpios")
    .where("num_gpios", "is not", null)
    .execute()

  const expanders = await query.execute()

  if (ctx.isApiRequest) {
    return {
      expanders,
      packages,
      gpioCounts
    }
  }

  return ctx.react(
    <div>
      <h2>I/O Expanders</h2>

      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Package:</label>
          <select name="package">
            <option value="">All</option>
            {packages.map((p: { package: string | null }) => (
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
          <label>Number of GPIOs:</label>
          <select name="num_gpios">
            <option value="">All</option>
            {gpioCounts.map((g: { num_gpios: number | null }) => (
              <option
                key={g.num_gpios}
                value={g.num_gpios ?? ""}
                selected={g.num_gpios === req.query.num_gpios}
              >
                {g.num_gpios}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Interface:</label>
          <select name="interface">
            <option value="">All</option>
            <option value="i2c" selected={req.query.interface === "i2c"}>
              I²C
            </option>
            <option value="spi" selected={req.query.interface === "spi"}>
              SPI
            </option>
            <option value="smbus" selected={req.query.interface === "smbus"}>
              SMBus
            </option>
          </select>
        </div>

        <div>
          <label>Has Interrupt:</label>
          <select name="has_interrupt">
            <option value="">All</option>
            <option value="true" selected={req.query.has_interrupt === true}>
              Yes
            </option>
            <option value="false" selected={req.query.has_interrupt === false}>
              No
            </option>
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={expanders.map((e: any) => ({
          lcsc: e.lcsc,
          mfr: e.mfr,
          package: e.package,
          gpios: e.num_gpios,
          voltage:
            e.supply_voltage_min && e.supply_voltage_max ? (
              <span className="tabular-nums">
                {e.supply_voltage_min}V - {e.supply_voltage_max}V
              </span>
            ) : (
              ""
            ),
          interface: [
            e.has_i2c && "I²C",
            e.has_spi && "SPI",
            e.has_smbus && "SMBus",
          ]
            .filter(Boolean)
            .join(", "),
          interrupt: e.has_interrupt ? "Yes" : "No",
          current: e.sink_current_ma && (
            <span className="tabular-nums">
              {e.sink_current_ma}mA sink
              {e.source_current_ma && ` / ${e.source_current_ma}mA source`}
            </span>
          ),
          clock: e.clock_frequency_hz && (
            <span className="tabular-nums">
              {formatSiUnit(e.clock_frequency_hz)}Hz
            </span>
          ),
          stock: <span className="tabular-nums">{e.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(e.price1)}</span>,
        }))}
      />
    </div>,
  )
}

const routeWithApi = withIsApiRequest(route)
export default withWinterSpec(spec)(routeWithApi)
