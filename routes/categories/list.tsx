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
    categories = [
      ...categories.reduce((acc: Set<string>, c: { category: string }) => {
        acc.add(c.category)
        return acc
      }, new Set()),
    ].map((c: string) => ({ category: c }))
  }

  return ctx.react(
    <div>
      <h2>Categories</h2>
      <div>Click for subcategories</div>
      <Table
        rows={categories.map((c) => ({
          category: (
            <a href={`/admin/categories/list?category_name=${c.category}`}>
              {c.category}
            </a>
          ),
          subcategory: (
            <a
              href={`/admin/components/list?subcategory_name=${c.subcategory}`}
            >
              {c.subcategory}
            </a>
          ),
        }))}
      />
    </div>,
  )
})
