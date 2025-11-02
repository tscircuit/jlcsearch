import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"
import { formatSiUnit } from "lib/util/format-si-unit"

const formatNumber = (value: number) =>
  Number.isInteger(value)
    ? value.toString()
    : value
        .toFixed(2)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*[1-9])0+$/, "$1")

const formatRange = (
  min: number | null | undefined,
  max: number | null | undefined,
  unit: string,
) => {
  if (min == null && max == null) return ""
  if (min != null && max != null)
    return `${formatNumber(min)}${unit} - ${formatNumber(max)}${unit}`
  const value = min ?? max
  if (value == null) return ""
  return `${formatNumber(value)}${unit}`
}

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    type: z.string().optional(),
    logic_elements_min: z.coerce.number().optional(),
    logic_array_blocks_min: z.coerce.number().optional(),
    embedded_ram_min_bits: z.coerce.number().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  let query = ctx.db
    .selectFrom("fpga")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  if (req.query.type) {
    query = query.where("type", "=", req.query.type)
  }

  if (req.query.logic_elements_min) {
    query = query.where("logic_elements", ">=", req.query.logic_elements_min)
  }

  if (req.query.logic_array_blocks_min) {
    query = query.where(
      "logic_array_blocks",
      ">=",
      req.query.logic_array_blocks_min,
    )
  }

  if (req.query.embedded_ram_min_bits) {
    query = query.where(
      "embedded_ram_bits",
      ">=",
      req.query.embedded_ram_min_bits,
    )
  }

  const packages = await ctx.db
    .selectFrom("fpga")
    .select("package")
    .distinct()
    .where("package", "is not", null)
    .orderBy("package")
    .execute()

  const types = await ctx.db
    .selectFrom("fpga")
    .select("type")
    .distinct()
    .where("type", "is not", null)
    .orderBy("type")
    .execute()

  const fpgas = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      fpgas: fpgas.map((f) => ({
        lcsc: f.lcsc ?? 0,
        mfr: f.mfr ?? "",
        package: f.package ?? "",
        type: f.type ?? null,
        logic_array_blocks: f.logic_array_blocks ?? null,
        logic_elements: f.logic_elements ?? null,
        embedded_ram_bits: f.embedded_ram_bits ?? null,
        supply_voltage_min: f.supply_voltage_min ?? null,
        supply_voltage_max: f.supply_voltage_max ?? null,
        operating_temp_min: f.operating_temp_min ?? null,
        operating_temp_max: f.operating_temp_max ?? null,
        max_delay_ns: f.max_delay_ns ?? null,
        logic_gates: f.logic_gates ?? null,
        stock: f.stock ?? null,
        price1: f.price1 ?? null,
      })),
    })
  }

  return ctx.react(
    <div>
      <h2>FPGAs &amp; CPLDs</h2>

      <form method="GET" className="flex flex-row flex-wrap gap-4">
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
          <label>Type:</label>
          <select name="type">
            <option value="">All</option>
            {types.map((t) => (
              <option
                key={t.type}
                value={t.type ?? ""}
                selected={t.type === req.query.type}
              >
                {t.type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Min Logic Elements:</label>
          <input
            type="number"
            name="logic_elements_min"
            placeholder="Count"
            defaultValue={req.query.logic_elements_min}
          />
        </div>

        <div>
          <label>Min Logic Array Blocks:</label>
          <input
            type="number"
            name="logic_array_blocks_min"
            placeholder="Count"
            defaultValue={req.query.logic_array_blocks_min}
          />
        </div>

        <div>
          <label>Min Embedded RAM (bits):</label>
          <input
            type="number"
            name="embedded_ram_min_bits"
            placeholder="Bits"
            defaultValue={req.query.embedded_ram_min_bits}
          />
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={fpgas.map((f) => ({
          lcsc: f.lcsc,
          mfr: f.mfr,
          package: f.package,
          type: f.type ?? "",
          "logic blocks": f.logic_array_blocks ?? "",
          "logic elements": f.logic_elements
            ? formatSiUnit(f.logic_elements)
            : "",
          "embedded ram": f.embedded_ram_bits
            ? `${formatSiUnit(f.embedded_ram_bits)}b`
            : "",
          "supply voltage": formatRange(
            f.supply_voltage_min,
            f.supply_voltage_max,
            "V",
          ),
          "operating temp": formatRange(
            f.operating_temp_min,
            f.operating_temp_max,
            "°C",
          ),
          "max delay":
            f.max_delay_ns != null ? `${formatSiUnit(f.max_delay_ns)}ns` : "",
          "logic gates": f.logic_gates ? formatSiUnit(f.logic_gates) : "",
          stock: f.stock,
          price: formatPrice(f.price1 ?? null),
        }))}
      />
    </div>,
  )
})
