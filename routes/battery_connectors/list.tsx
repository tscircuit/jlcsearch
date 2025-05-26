import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  commonParams: z.object({
    json: z.boolean().optional(),
    package: z.string().optional(),
    battery_type: z.string().optional(),
    number_of_contacts: z.string().optional(),
    operating_temperature: z.string().optional(),
    mfr: z.string().optional(),
    description: z.string().optional(),
  }),
  jsonResponse: z.object({
    battery_connectors: z.array(
      z.object({
        lcsc: z.number(),
        mfr: z.string(),
        package: z.string(),
        description: z.string(),
        stock: z.number(),
        price1: z.number(),
        battery_type: z.string().optional(),
        number_of_contacts: z.number().optional(),
        operating_temperature: z.string().optional(),
      }),
    ),
  }),
} as const)(async (req, ctx) => {
  const params = req.commonParams
  const limit = 100
  const search = "Battery Connector"
  const searchPattern = `%${search}%`

  let query = ctx.db
    .selectFrom("battery_connector")
    .select([
      "lcsc",
      "mfr",
      "package",
      "description",
      "stock",
      "price1",
      "battery_type",
      "number_of_contacts",
      "operating_temperature",
    ] as const)
    .limit(limit)
    .orderBy("stock", "desc")
    .where("stock", ">", 0)
    .where((eb) =>
      eb("description", "like", searchPattern)
        .or("mfr", "like", searchPattern)
        .or(
          search.match(/^\d+$/)
            ? eb("lcsc", "=", parseInt(search))
            : eb("description", "like", searchPattern),
        ),
    )

  // Add filters for each column
  if (params.package) {
    query = query.where("package", "=", params.package)
  }
  if (params.battery_type) {
    query = query.where("battery_type", "=", params.battery_type)
  }
  if (params.number_of_contacts) {
    query = query.where(
      "number_of_contacts",
      "=",
      parseInt(params.number_of_contacts),
    )
  }
  if (params.operating_temperature) {
    query = query.where(
      "operating_temperature",
      "=",
      params.operating_temperature,
    )
  }
  if (params.mfr) {
    query = query.where("mfr", "like", `%${params.mfr}%`)
  }
  if (params.description) {
    query = query.where("description", "like", `%${params.description}%`)
  }

  const fullComponents = await query.execute()
  const components = fullComponents.map((c) => ({
    lcsc: c.lcsc,
    mfr: c.mfr,
    package: c.package,
    description: c.description,
    stock: c.stock,
    price: c.price1,
    battery_type: c.battery_type,
    number_of_contacts: c.number_of_contacts,
    operating_temperature: c.operating_temperature,
  }))

  if (ctx.isApiRequest) {
    return ctx.json({
      battery_connectors: fullComponents
        .map((c) => ({
          lcsc: c.lcsc ?? 0,
          mfr: c.mfr ?? "",
          package: c.package ?? "",
          description: c.description ?? "",
          stock: c.stock ?? 0,
          price1: c.price1 ?? 0,
          battery_type: c.battery_type ?? undefined,
          number_of_contacts: c.number_of_contacts ?? undefined,
          operating_temperature: c.operating_temperature ?? undefined,
        }))
        .filter((c) => c.lcsc !== 0 && c.package !== ""),
    })
  }

  // Get unique values for filters
  const packages = await ctx.db
    .selectFrom("battery_connector")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  const batteryTypes = await ctx.db
    .selectFrom("battery_connector")
    .select("battery_type")
    .distinct()
    .orderBy("battery_type")
    .execute()

  const contactCounts = await ctx.db
    .selectFrom("battery_connector")
    .select("number_of_contacts")
    .distinct()
    .orderBy("number_of_contacts")
    .execute()

  const operatingTemps = await ctx.db
    .selectFrom("battery_connector")
    .select("operating_temperature")
    .distinct()
    .orderBy("operating_temperature")
    .execute()

  return ctx.react(
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Battery Connectors</h2>
      <form
        method="GET"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg"
      >
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Package:
          </label>
          <select name="package" className="border px-3 py-2 rounded-md">
            <option value="">All</option>
            {packages.map((p) => (
              <option
                key={p.package}
                value={p.package ?? ""}
                selected={p.package === params.package}
              >
                {p.package || "-"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Battery Type:
          </label>
          <select name="battery_type" className="border px-3 py-2 rounded-md">
            <option value="">All</option>
            {batteryTypes.map((t) => (
              <option
                key={t.battery_type}
                value={t.battery_type ?? ""}
                selected={t.battery_type === params.battery_type}
              >
                {t.battery_type || "N/A"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Number of Contacts:
          </label>
          <select
            name="number_of_contacts"
            className="border px-3 py-2 rounded-md"
          >
            <option value="">All</option>
            {contactCounts.map((c) => (
              <option
                key={c.number_of_contacts}
                value={c.number_of_contacts ?? ""}
                selected={
                  c.number_of_contacts?.toString() === params.number_of_contacts
                }
              >
                {c.number_of_contacts || "N/A"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Operating Temperature:
          </label>
          <select
            name="operating_temperature"
            className="border px-3 py-2 rounded-md"
          >
            <option value="">All</option>
            {operatingTemps.map((t) => (
              <option
                key={t.operating_temperature}
                value={t.operating_temperature ?? ""}
                selected={
                  t.operating_temperature === params.operating_temperature
                }
              >
                {t.operating_temperature || "N/A"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <Table
          rows={components.map((c) => ({
            lcsc: c.lcsc,
            mfr: c.mfr,
            package: c.package,
            description: c.description,
            battery_type: c.battery_type,
            number_of_contacts: c.number_of_contacts,
            operating_temperature: c.operating_temperature,
            stock: <span className="tabular-nums">{c.stock}</span>,
            price: <span className="tabular-nums">{formatPrice(c.price)}</span>,
          }))}
        />
      </div>
    </div>,
    "JLCPCB Battery Connector Search",
  )
})
