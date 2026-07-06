import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    interface: z.enum(["spi", "i2c", "uart", ""]).optional(),
    has_magnetometer: z.boolean().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  let query = ctx.db
    .selectFrom("imu")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  if (req.query.interface) {
    switch (req.query.interface) {
      case "spi":
        query = query.where("has_spi", "=", 1)
        break
      case "i2c":
        query = query.where("has_i2c", "=", 1)
        break
      case "uart":
        query = query.where("has_uart", "=", 1)
        break
    }
  }

  if (req.query.has_magnetometer) {
    query = query.where("has_magnetometer", "=", 1)
  }

  const packages = await ctx.db
    .selectFrom("imu")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  const imus = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      imus: imus
        .map((g) => ({
          lcsc: g.lcsc ?? 0,
          mfr: g.mfr ?? "",
          package: g.package ?? "",
          supply_voltage_min: g.supply_voltage_min ?? undefined,
          supply_voltage_max: g.supply_voltage_max ?? undefined,
          axes: g.axes ?? undefined,
          has_accelerometer: g.has_accelerometer === 1,
          has_gyroscope: g.has_gyroscope === 1,
          has_magnetometer: g.has_magnetometer === 1,
          has_i2c: g.has_i2c === 1,
          has_spi: g.has_spi === 1,
          has_uart: g.has_uart === 1,
          stock: g.stock ?? undefined,
          price1: g.price1 ?? undefined,
        }))
        .filter((g) => g.lcsc !== 0 && g.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>IMUs (Inertial Measurement Units)</h2>

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
          <label>Interface:</label>
          <select name="interface">
            <option value="">All</option>
            <option value="spi" selected={req.query.interface === "spi"}>
              SPI
            </option>
            <option value="i2c" selected={req.query.interface === "i2c"}>
              I2C
            </option>
            <option value="uart" selected={req.query.interface === "uart"}>
              UART
            </option>
          </select>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              name="has_magnetometer"
              value="true"
              checked={req.query.has_magnetometer}
            />
            {" Has Magnetometer"}
          </label>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={imus.map((g) => ({
          lcsc: g.lcsc,
          mfr: g.mfr,
          package: g.package,
          voltage:
            g.supply_voltage_min && g.supply_voltage_max ? (
              <span className="tabular-nums">
                {g.supply_voltage_min}V - {g.supply_voltage_max}V
              </span>
            ) : (
              ""
            ),
          axes: g.axes,
          sensors: [
            g.has_accelerometer && "Accel",
            g.has_gyroscope && "Gyro",
            g.has_magnetometer && "Mag",
          ]
            .filter(Boolean)
            .join("+"),
          interface: [
            g.has_spi && "SPI",
            g.has_i2c && "I2C",
            g.has_uart && "UART",
          ]
            .filter(Boolean)
            .join(", "),
          stock: <span className="tabular-nums">{g.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(g.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB IMU Search",
  )
})
