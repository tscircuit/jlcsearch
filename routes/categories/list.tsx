import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"

export default withWinterSpec({
  auth: "none",
  methods: ["GET", "POST"],
  queryParams: z.object({
    category_name: z.string().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  let categories: Array<{ category: string; subcategory?: string }> =
    await ctx.db.selectFrom("categories").selectAll().execute()

  if (req.query.category_name) {
    categories = categories.filter(
      (c: { category: string }) => c.category === req.query.category_name,
    )
  } else {
    // Group categories and their subcategories
    const categoryMap = categories.reduce(
      (acc: Map<string, Set<string>>, c) => {
        if (!acc.has(c.category)) {
          acc.set(c.category, new Set<string>())
        }
        if (c.subcategory) {
          acc.get(c.category)!.add(c.subcategory)
        }
        return acc
      },
      new Map<string, Set<string>>(),
    )

    categories = Array.from(categoryMap.entries()).map(
      ([category, subcategories]) => ({
        category,
        subcategory: Array.from(subcategories)[0] as string | undefined,
      }),
    )
  }

  if (ctx.isApiRequest) {
    return ctx.json({
      categories: categories.map((c) => ({
        category: c.category,
        subcategory: c.subcategory,
      })),
    })
  }

  return ctx.react(
    <div>
      <h2>Categories</h2>
      <div>Click for subcategories</div>
      <Table
        rows={categories.map((c) => ({
          category: (
            <a href={`/categories/list?category_name=${c.category}`}>
              {c.category}
            </a>
          ),
          subcategory: (
            <a href={`/components/list?subcategory_name=${c.subcategory}`}>
              {c.subcategory}
            </a>
          ),
        }))}
      />
    </div>,
    "JLCPCB Component Categories",
  )
})
