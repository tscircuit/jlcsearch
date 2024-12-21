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
    core: z.string().optional(),
    flash_min: z.coerce.number().optional(),
    ram_min: z.coerce.number().optional(),
    interface: z.enum(["uart", "i2c", "spi", "can", "usb", ""]).optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("microcontroller")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  // Apply core filter
  if (req.query.core) {
    query = query.where("cpu_core", "=", req.query.core)
  }

  // Apply minimum flash size filter
  if (req.query.flash_min) {
    query = query.where("flash_size_bytes", ">=", req.query.flash_min)
  }

  // Apply minimum RAM size filter
  if (req.query.ram_min) {
    query = query.where("ram_size_bytes", ">=", req.query.ram_min)
  }

  // Apply interface filter
  if (req.query.interface) {
    switch (req.query.interface) {
      case "uart":
        query = query.where("has_uart", "=", 1)
        break
      case "i2c":
        query = query.where("has_i2c", "=", 1)
        break
      case "spi":
        query = query.where("has_spi", "=", 1)
        break
      case "can":
        query = query.where("has_can", "=", 1)
        break
      case "usb":
        query = query.where("has_usb", "=", 1)
        break
    }
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("microcontroller")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  // Get unique cores for dropdown
  const cores = await ctx.db
    .selectFrom("microcontroller")
    .select("cpu_core")
    .distinct()
    .orderBy("cpu_core")
    .where("cpu_core", "is not", null)
    .execute()

  const mcus = await query.execute()

  return ctx.react(
    <div>
      <h2>Microcontrollers</h2>

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
          <label>Core:</label>
          <select name="core">
            <option value="">All</option>
            {cores.map((c) => (
              <option
                key={c.cpu_core}
                value={c.cpu_core ?? ""}
                selected={c.cpu_core === req.query.core}
              >
                {c.cpu_core}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Min Flash:</label>
          <input
            type="number"
            name="flash_min"
            placeholder="Bytes"
            defaultValue={req.query.flash_min}
          />
        </div>

        <div>
          <label>Min RAM:</label>
          <input
            type="number"
            name="ram_min"
            placeholder="Bytes"
            defaultValue={req.query.ram_min}
          />
        </div>

        <div>
          <label>Interface:</label>
          <select name="interface">
            <option value="">All</option>
            <option value="uart" selected={req.query.interface === "uart"}>
              UART
            </option>
            <option value="i2c" selected={req.query.interface === "i2c"}>
              I²C
            </option>
            <option value="spi" selected={req.query.interface === "spi"}>
              SPI
            </option>
            <option value="can" selected={req.query.interface === "can"}>
              CAN
            </option>
            <option value="usb" selected={req.query.interface === "usb"}>
              USB
            </option>
          </select>
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={mcus.map((m: any) => ({
          lcsc: m.lcsc,
          mfr: m.mfr,
          package: m.package,
          core: m.cpu_core,
          speed: m.cpu_speed_hz ? (
            <span className="tabular-nums">
              {formatSiUnit(m.cpu_speed_hz)}Hz
            </span>
          ) : (
            ""
          ),
          flash: m.flash_size_bytes ? (
            <span className="tabular-nums">
              {formatSiUnit(m.flash_size_bytes)}B
            </span>
          ) : (
            ""
          ),
          ram: m.ram_size_bytes ? (
            <span className="tabular-nums">
              {formatSiUnit(m.ram_size_bytes)}B
            </span>
          ) : (
            ""
          ),
          eeprom: m.eeprom_size_bytes ? (
            <span className="tabular-nums">
              {formatSiUnit(m.eeprom_size_bytes)}B
            </span>
          ) : (
            ""
          ),
          gpio: m.gpio_count,
          interfaces: [
            m.has_uart && "UART",
            m.has_i2c && "I²C",
            m.has_spi && "SPI",
            m.has_can && "CAN",
            m.has_usb && "USB",
          ]
            .filter(Boolean)
            .join(", "),
          peripherals: [
            m.has_adc && "ADC",
            m.has_dac && "DAC",
            m.has_pwm && "PWM",
            m.has_dma && "DMA",
            m.has_rtc && "RTC",
          ]
            .filter(Boolean)
            .join(", "),
          voltage:
            m.supply_voltage_min && m.supply_voltage_max ? (
              <span className="tabular-nums">
                {m.supply_voltage_min}V - {m.supply_voltage_max}V
              </span>
            ) : (
              ""
            ),
          stock: <span className="tabular-nums">{m.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(m.price1)}</span>,
        }))}
      />
    </div>,
  )
})
