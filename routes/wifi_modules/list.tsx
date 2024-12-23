import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"
import { formatSiUnit } from "lib/util/format-si-unit"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    core_processor: z.string().optional(),
    antenna_type: z.string().optional(),
    interface: z.enum(["uart", "spi", "i2c", "gpio", "adc", "pwm", ""]).optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("wifi_module")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  // Apply core processor filter
  if (req.query.core_processor) {
    query = query.where("core_processor", "=", req.query.core_processor)
  }

  // Apply antenna type filter
  if (req.query.antenna_type) {
    query = query.where("antenna_type", "=", req.query.antenna_type)
  }

  // Apply interface filter
  if (req.query.interface) {
    switch (req.query.interface) {
      case "uart":
        query = query.where("has_uart", "=", 1)
        break
      case "spi":
        query = query.where("has_spi", "=", 1)
        break
      case "i2c":
        query = query.where("has_i2c", "=", 1)
        break
      case "gpio":
        query = query.where("has_gpio", "=", 1)
        break
      case "adc":
        query = query.where("has_adc", "=", 1)
        break
      case "pwm":
        query = query.where("has_pwm", "=", 1)
        break
    }
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("wifi_module")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  // Get unique core processors for dropdown
  const processors = await ctx.db
    .selectFrom("wifi_module")
    .select("core_processor")
    .distinct()
    .orderBy("core_processor")
    .where("core_processor", "is not", null)
    .execute()

  // Get unique antenna types for dropdown
  const antennaTypes = await ctx.db
    .selectFrom("wifi_module")
    .select("antenna_type")
    .distinct()
    .orderBy("antenna_type")
    .where("antenna_type", "is not", null)
    .execute()

  const modules = await query.execute()

  // Return JSON response if requested
  if (ctx.isApiRequest) {
    return ctx.json({
      wifi_modules: modules
        .map((m) => ({
          lcsc: m.lcsc ?? 0,
          mfr: m.mfr ?? "",
          package: m.package ?? "",
          core_processor: m.core_processor ?? undefined,
          antenna_type: m.antenna_type ?? undefined,
          operating_voltage: m.operating_voltage ?? undefined,
          frequency_ghz: m.frequency_ghz ?? undefined,
          sensitivity_dbm: m.sensitivity_dbm ?? undefined,
          output_power_dbm: m.output_power_dbm ?? undefined,
          tx_current_ma: m.tx_current_ma ?? undefined,
          rx_current_ma: m.rx_current_ma ?? undefined,
          has_uart: m.has_uart ?? undefined,
          has_spi: m.has_spi ?? undefined,
          has_i2c: m.has_i2c ?? undefined,
          has_gpio: m.has_gpio ?? undefined,
          has_adc: m.has_adc ?? undefined,
          has_pwm: m.has_pwm ?? undefined,
          stock: m.stock ?? undefined,
          price1: m.price1 ?? undefined,
        }))
        .filter((m) => m.lcsc !== 0 && m.package !== ""),
    })
  }

  return ctx.react(
    <div>
      <h2>WiFi Modules</h2>

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
          <label>Core Processor:</label>
          <select name="core_processor">
            <option value="">All</option>
            {processors.map((p) => (
              <option
                key={p.core_processor}
                value={p.core_processor ?? ""}
                selected={p.core_processor === req.query.core_processor}
              >
                {p.core_processor}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Antenna Type:</label>
          <select name="antenna_type">
            <option value="">All</option>
            {antennaTypes.map((t) => (
              <option
                key={t.antenna_type}
                value={t.antenna_type ?? ""}
                selected={t.antenna_type === req.query.antenna_type}
              >
                {t.antenna_type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Interface:</label>
          <select name="interface">
            <option value="">All</option>
            <option value="uart" selected={req.query.interface === "uart"}>
              UART
            </option>
            <option value="spi" selected={req.query.interface === "spi"}>
              SPI
            </option>
            <option value="i2c" selected={req.query.interface === "i2c"}>
              I²C
            </option>
            <option value="gpio" selected={req.query.interface === "gpio"}>
              GPIO
            </option>
            <option value="adc" selected={req.query.interface === "adc"}>
              ADC
            </option>
            <option value="pwm" selected={req.query.interface === "pwm"}>
              PWM
            </option>
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={modules.map((m) => ({
          lcsc: m.lcsc,
          mfr: m.mfr,
          package: m.package,
          processor: m.core_processor,
          antenna: m.antenna_type,
          voltage: m.operating_voltage ? `${m.operating_voltage}V` : "",
          frequency: m.frequency_ghz ? `${m.frequency_ghz}GHz` : "",
          sensitivity: m.sensitivity_dbm ? `${m.sensitivity_dbm}dBm` : "",
          tx_power: m.output_power_dbm ? `${m.output_power_dbm}dBm` : "",
          current: m.tx_current_ma && (
            <span className="tabular-nums">
              {m.tx_current_ma}mA TX
              {m.rx_current_ma && ` / ${m.rx_current_ma}mA RX`}
            </span>
          ),
          interfaces: [
            m.has_uart && "UART",
            m.has_spi && "SPI",
            m.has_i2c && "I²C",
            m.has_gpio && "GPIO",
            m.has_adc && "ADC",
            m.has_pwm && "PWM",
          ]
            .filter(Boolean)
            .join(", "),
          stock: <span className="tabular-nums">{m.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(m.price1)}</span>,
        }))}
      />
    </div>,
  )
})
