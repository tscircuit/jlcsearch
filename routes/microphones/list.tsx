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
  const categoryIds = await ctx.db
    .selectFrom("categories")
    .select(["id", "subcategory"])
    .where("subcategory", "in", [...MICROPHONE_SUBCATEGORIES])
    .execute()
  const ids = categoryIds
    .map((c) => c.id)
    .filter((id): id is number => id !== null)

  const subcategoryMap = new Map<number, string>()
  for (const cat of categoryIds) {
    if (cat.id !== null && cat.subcategory !== null) {
      subcategoryMap.set(cat.id, cat.subcategory)
    }
  }

  const selectedType = req.query.microphone_type

  let query = ctx.db
    .selectFrom("components")
    .select([
      "lcsc",
      "mfr",
      "package",
      "description",
      "stock",
      "price",
      "category_id",
    ])
    .where("stock", ">", 0)
    .orderBy("stock", "desc")
    .limit(100)

  if (selectedType && selectedType !== "all") {
    const filteredIds = categoryIds
      .filter((c) => c.subcategory === selectedType)
      .map((c) => c.id)
      .filter((id): id is number => id !== null)
    query = query.where("category_id", "in", filteredIds)
  } else {
    query = query.where("category_id", "in", ids)
  }

  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  const microphones = await query.execute()

  const packages = await ctx.db
    .selectFrom("components")
    .select("package")
    .distinct()
    .where("category_id", "in", ids)
    .where("package", "is not", null)
    .orderBy("package")
    .execute()

  const normalizedMicrophones = microphones
    .map((m) => ({
      lcsc: m.lcsc ?? 0,
      mfr: m.mfr ?? "",
      package: m.package ?? "",
      microphone_type: m.category_id
        ? (subcategoryMap.get(m.category_id) ?? "")
        : "",
      description: m.description ?? "",
      stock: m.stock ?? 0,
      price1: extractMinQPrice(m.price ?? ""),
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
