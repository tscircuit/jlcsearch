import { Table } from "lib/ui/Table"
import { formatPrice } from "lib/util/format-price"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

const INTERFACE_OPTIONS = ["spi", "i2c", "uart", ""] as const

type SensorKind = "accelerometer" | "gyroscope"

const applyInterfaceFilter = <T,>(
  query: T,
  interfaceName: (typeof INTERFACE_OPTIONS)[number] | undefined,
): T => {
  if (!interfaceName) return query

  switch (interfaceName) {
    case "spi":
      return (query as any).where("has_spi", "=", 1)
    case "i2c":
      return (query as any).where("has_i2c", "=", 1)
    case "uart":
      return (query as any).where("has_uart", "=", 1)
    default:
      return query
  }
}

const normalizeImu = (kind: SensorKind, sensor: any) => ({
  type: kind,
  lcsc: sensor.lcsc ?? 0,
  mfr: sensor.mfr ?? "",
  package: sensor.package ?? "",
  supply_voltage_min: sensor.supply_voltage_min ?? undefined,
  supply_voltage_max: sensor.supply_voltage_max ?? undefined,
  axes: sensor.axes ?? undefined,
  has_i2c: sensor.has_i2c === 1,
  has_spi: sensor.has_spi === 1,
  has_uart: sensor.has_uart === 1,
  stock: sensor.stock ?? undefined,
  price1: sensor.price1 ?? undefined,
})

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    interface: z.enum(INTERFACE_OPTIONS).optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  let accelerometerQuery = ctx.db
    .selectFrom("accelerometer")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")
  let gyroscopeQuery = ctx.db
    .selectFrom("gyroscope")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  if (req.query.package) {
    accelerometerQuery = accelerometerQuery.where(
      "package",
      "=",
      req.query.package,
    )
    gyroscopeQuery = gyroscopeQuery.where("package", "=", req.query.package)
  }

  accelerometerQuery = applyInterfaceFilter(
    accelerometerQuery,
    req.query.interface,
  )
  gyroscopeQuery = applyInterfaceFilter(gyroscopeQuery, req.query.interface)

  const accelerometerPackages = await ctx.db
    .selectFrom("accelerometer")
    .select("package")
    .distinct()
    .where("package", "is not", null)
    .orderBy("package")
    .execute()
  const gyroscopePackages = await ctx.db
    .selectFrom("gyroscope")
    .select("package")
    .distinct()
    .where("package", "is not", null)
    .orderBy("package")
    .execute()
  const accelerometers = await accelerometerQuery.execute()
  const gyroscopes = await gyroscopeQuery.execute()

  const imus = [
    ...accelerometers.map((sensor) => normalizeImu("accelerometer", sensor)),
    ...gyroscopes.map((sensor) => normalizeImu("gyroscope", sensor)),
  ]
    .filter((sensor) => sensor.lcsc !== 0 && sensor.package !== "")
    .sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0))
    .slice(0, 100)

  if (ctx.isApiRequest) {
    return ctx.json({ imus })
  }

  const packages = Array.from(
    new Set(
      [...accelerometerPackages, ...gyroscopePackages]
        .map((row) => row.package?.trim() ?? "")
        .filter(Boolean),
    ),
  ).sort()

  return ctx.react(
    <div>
      <h2>IMUs</h2>

      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Package:</label>
          <select name="package">
            <option value="">All</option>
            {packages.map((pkg) => (
              <option
                key={pkg}
                value={pkg}
                selected={pkg === req.query.package}
              >
                {pkg}
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

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={imus.map((sensor) => ({
          type: sensor.type,
          lcsc: sensor.lcsc,
          mfr: sensor.mfr,
          package: sensor.package,
          voltage:
            sensor.supply_voltage_min && sensor.supply_voltage_max ? (
              <span className="tabular-nums">
                {sensor.supply_voltage_min}V - {sensor.supply_voltage_max}V
              </span>
            ) : (
              ""
            ),
          axes: sensor.axes,
          interface: [
            sensor.has_spi && "SPI",
            sensor.has_i2c && "I2C",
            sensor.has_uart && "UART",
          ]
            .filter(Boolean)
            .join(", "),
          stock: <span className="tabular-nums">{sensor.stock}</span>,
          price: (
            <span className="tabular-nums">{formatPrice(sensor.price1)}</span>
          ),
        }))}
      />
    </div>,
    "JLCPCB IMU Search",
  )
})
