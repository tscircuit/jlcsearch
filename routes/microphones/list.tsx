import { Table } from "lib/ui/Table"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

const MICROPHONE_SUBCATEGORIES = ["Microphones", "MEMS Microphones"] as const

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    microphone_type: z.enum(["all", ...MICROPHONE_SUBCATEGORIES]).optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  const selectedType = req.query.microphone_type

  let query = ctx.db
    .selectFrom("components")
    .innerJoin("categories", "components.category_id", "categories.id")
    .select([
      "components.lcsc",
      "components.mfr",
      "components.package",
      "components.description",
      "components.stock",
      "components.price",
      "categories.subcategory as subcategory",
    ])
    .where("components.stock", ">", 0)
    .where("categories.subcategory", "in", [...MICROPHONE_SUBCATEGORIES])
    .orderBy("components.stock", "desc")
    .limit(100)

  if (req.query.package) {
    query = query.where("components.package", "=", req.query.package)
  }

  if (selectedType && selectedType !== "all") {
    query = query.where("categories.subcategory", "=", selectedType)
  }

  const microphones = await query.execute()

  const packages = await ctx.db
    .selectFrom("components")
    .innerJoin("categories", "components.category_id", "categories.id")
    .select("components.package")
    .distinct()
    .where("categories.subcategory", "in", [...MICROPHONE_SUBCATEGORIES])
    .where("components.package", "is not", null)
    .orderBy("components.package")
    .execute()

  const normalizedMicrophones = microphones
    .map((m) => ({
      lcsc: m.lcsc ?? 0,
      mfr: m.mfr ?? "",
      package: m.package ?? "",
      microphone_type: m.subcategory ?? "",
      description: m.description ?? "",
      stock: m.stock ?? 0,
      price1: extractMinQPrice(m.price ?? "") ?? 0,
    }))
    .filter((m) => m.lcsc !== 0 && m.package !== "")

  if (ctx.isApiRequest) {
    return ctx.json({ microphones: normalizedMicrophones })
  }

  return ctx.react(
    <div>
      <h2>Microphones</h2>
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
          <label>Type:</label>
          <select name="microphone_type">
            <option
              value="all"
              selected={!selectedType || selectedType === "all"}
            >
              All
            </option>
            {MICROPHONE_SUBCATEGORIES.map((type) => (
              <option key={type} value={type} selected={selectedType === type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Filter</button>
      </form>
      <Table rows={normalizedMicrophones} />
    </div>,
  )
})
