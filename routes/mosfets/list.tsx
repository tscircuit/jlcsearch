import { withWinterSpec } from "lib/with-winter-spec";
import { z } from "zod";
import type { DB } from "lib/db/generated/kysely";
import { Kysely } from "kysely";
import { formatPrice } from "lib/util/format-price";
import { Table } from "lib/ui/Table";

type KyselyDatabaseInstance = Kysely<DB>

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
    drain_source_voltage_min: z.coerce.number().optional(),
    drain_source_voltage_max: z.coerce.number().optional(),
    continuous_drain_current_min: z.coerce.number().optional(),
    continuous_drain_current_max: z.coerce.number().optional(),
    gate_threshold_voltage_min: z.coerce.number().optional(),
    gate_threshold_voltage_max: z.coerce.number().optional(),
    power_dissipation_min: z.coerce.number().optional(),
    power_dissipation_max: z.coerce.number().optional(),
    mounting_style: z.string().optional(),
  }),
  jsonResponse: z.string().or(
    z.object({
      mosfets: z.array(
        z.object({
          lcsc: z.number(),
          mfr: z.string(),
          description: z.string(),
          stock: z.number(),
          price1: z.number().nullable(),
          in_stock: z.boolean(),
          package: z.string().nullable(),
          drain_source_voltage: z.number().nullable(),
          continuous_drain_current: z.number().nullable(),
          gate_threshold_voltage: z.number().nullable(),
          power_dissipation: z.number().nullable(),
          operating_temp_min: z.number().nullable(),
          operating_temp_max: z.number().nullable(),
        }),
      ),
    }),
  ),
} as const)(async (req, ctx) => {
  const params = req.commonParams;
  let query = ctx.db
    .selectFrom("mosfet")
    .selectAll()
    .orderBy("stock", "desc")
    .limit(100);

  if (params.package) {
    query = query.where("package", "=", params.package);
  }
  if (params.drain_source_voltage_min !== undefined) {
    query = query.where("drain_source_voltage", ">=", params.drain_source_voltage_min);
  }
  if (params.drain_source_voltage_max !== undefined) {
    query = query.where("drain_source_voltage", "<=", params.drain_source_voltage_max);
  }
  if (params.continuous_drain_current_min !== undefined) {
    query = query.where("continuous_drain_current", ">=", params.continuous_drain_current_min);
  }
  if (params.continuous_drain_current_max !== undefined) {
    query = query.where("continuous_drain_current", "<=", params.continuous_drain_current_max);
  }
  if (params.gate_threshold_voltage_min !== undefined) {
    query = query.where("gate_threshold_voltage", ">=", params.gate_threshold_voltage_min);
  }
  if (params.gate_threshold_voltage_max !== undefined) {
    query = query.where("gate_threshold_voltage", "<=", params.gate_threshold_voltage_max);
  }
  if (params.power_dissipation_min !== undefined) {
    query = query.where("power_dissipation", ">=", params.power_dissipation_min);
  }
  if (params.power_dissipation_max !== undefined) {
    query = query.where("power_dissipation", "<=", params.power_dissipation_max);
  }
  if (params.mounting_style) {
    query = query.where("mounting_style", "=", params.mounting_style);
  }

  const results = await query.execute();

  if (ctx.isApiRequest) {
    return ctx.json({
      mosfets: results.map((mosfet) => ({
        lcsc: Number(mosfet.lcsc),
        mfr: String(mosfet.mfr || ""),
        description: String(mosfet.description || ""),
        stock: Number(mosfet.stock || 0),
        price1: mosfet.price1 === null ? null : Number(mosfet.price1),
        in_stock: Boolean((mosfet.stock || 0) > 0),
        package: mosfet.package,
        drain_source_voltage: mosfet.drain_source_voltage,
        continuous_drain_current: mosfet.continuous_drain_current,
        gate_threshold_voltage: mosfet.gate_threshold_voltage,
        power_dissipation: mosfet.power_dissipation,
        operating_temp_min: mosfet.operating_temp_min,
        operating_temp_max: mosfet.operating_temp_max,
      })),
    });
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("mosfet")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute();

  return ctx.react(
    <div>
      <h2>MOSFETs</h2>

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
          <div>Drain Source Voltage:</div>
          <input
            type="number"
            name="drain_source_voltage_min"
            placeholder="Min V"
            defaultValue={params.drain_source_voltage_min}
            step="0.1"
          />
          <input
            type="number"
            name="drain_source_voltage_max"
            placeholder="Max V"
            defaultValue={params.drain_source_voltage_max}
            step="0.1"
          />
        </div>

        <div>
          <div>Continuous Drain Current:</div>
          <input
            type="number"
            name="continuous_drain_current_min"
            placeholder="Min A"
            defaultValue={params.continuous_drain_current_min}
          />
          <input
            type="number"
            name="continuous_drain_current_max"
            placeholder="Max A"
            defaultValue={params.continuous_drain_current_max}
          />
        </div>

        <div>
          <div>Gate Threshold Voltage:</div>
          <input
            type="number"
            name="gate_threshold_voltage_min"
            placeholder="Min V"
            defaultValue={params.gate_threshold_voltage_min}
            step="0.1"
          />
          <input
            type="number"
            name="gate_threshold_voltage_max"
            placeholder="Max V"
            defaultValue={params.gate_threshold_voltage_max}
            step="0.1"
          />
        </div>

        <div>
          <div>Power Dissipation:</div>
          <input
            type="number"
            name="power_dissipation_min"
            placeholder="Min W"
            defaultValue={params.power_dissipation_min}
            step="0.1"
          />
          <input
            type="number"
            name="power_dissipation_max"
            placeholder="Max W"
            defaultValue={params.power_dissipation_max}
            step="0.1"
          />
        </div>

        <div>
          <label>Mounting Style:</label>
          <input
            type="text"
            name="mounting_style"
            placeholder="Style"
            defaultValue={params.mounting_style}
          />
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={results.map((m) => ({
          lcsc: m.lcsc,
          mfr: m.mfr,
          package: m.package,
          description: m.description,
          voltage: m.drain_source_voltage && (
            <span className="tabular-nums">
              {m.drain_source_voltage}V
            </span>
          ),
          current: m.continuous_drain_current && (
            <span className="tabular-nums">{m.continuous_drain_current}A</span>
          ),
          gate_threshold_voltage: m.gate_threshold_voltage && (
            <span className="tabular-nums">{m.gate_threshold_voltage}V</span>
          ),
          power_dissipation: m.power_dissipation && (
            <span className="tabular-nums">{m.power_dissipation}W</span>
          ),
          stock: <span className="tabular-nums">{m.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(m.price1)}</span>,
        }))}
      />
    </div>
  );
});