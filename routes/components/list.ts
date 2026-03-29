import { z } from "zod"
import { publicProcedure } from "../../lib/trpc"
import { getDb } from "../../lib/db/get-db"

export const listComponents = publicProcedure
  .input(
    z.object({
      // Pagination
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
      // Filters
      keyword: z.string().optional(),
      package: z.string().optional(),
      in_stock: z.boolean().optional(),
      is_basic: z.boolean().optional(),
      is_preferred: z.boolean().optional(),
      is_extended_promotional: z.boolean().optional(),
      // Stock / price
      stock_gte: z.number().int().optional(),
      // Sort
      order_by: z
        .enum([
          "stock_desc",
          "stock_asc",
          "price_asc",
          "price_desc",
          "lcsc_asc",
          "lcsc_desc",
        ])
        .optional()
        .default("stock_desc"),
    }),
  )
  .query(async ({ input }) => {
    const db = getDb()

    let query = db.selectFrom("components").selectAll()

    // Text search
    if (input.keyword) {
      const kw = `%${input.keyword}%`
      query = query.where((eb) =>
        eb.or([
          eb("description", "like", kw),
          eb("mfr", "like", kw),
          eb(eb.cast(eb.ref("lcsc"), "text"), "like", kw),
        ]),
      )
    }

    if (input.package) {
      query = query.where("package", "=", input.package)
    }

    if (input.in_stock !== undefined) {
      query = query.where("in_stock", "=", input.in_stock ? 1 : 0)
    }

    if (input.is_basic !== undefined) {
      query = query.where("is_basic", "=", input.is_basic ? 1 : 0)
    }

    if (input.is_preferred !== undefined) {
      query = query.where("is_preferred", "=", input.is_preferred ? 1 : 0)
    }

    if (input.is_extended_promotional !== undefined) {
      query = query.where(
        "is_extended_promotional",
        "=",
        input.is_extended_promotional ? 1 : 0,
      )
    }

    if (input.stock_gte !== undefined) {
      query = query.where("stock", ">=", input.stock_gte)
    }

    // Sorting
    switch (input.order_by) {
      case "stock_asc":
        query = query.orderBy("stock", "asc")
        break
      case "price_asc":
        query = query.orderBy("price1", "asc")
        break
      case "price_desc":
        query = query.orderBy("price1", "desc")
        break
      case "lcsc_asc":
        query = query.orderBy("lcsc", "asc")
        break
      case "lcsc_desc":
        query = query.orderBy("lcsc", "desc")
        break
      case "stock_desc":
      default:
        query = query.orderBy("stock", "desc")
        break
    }

    const rows = await query.limit(input.limit).offset(input.offset).execute()

    return {
      components: rows.map((r) => ({
        ...r,
        is_basic: Boolean(r.is_basic),
        is_preferred: Boolean(r.is_preferred),
        is_extended_promotional: Boolean(r.is_extended_promotional),
        in_stock: Boolean(r.in_stock),
      })),
    }
  })
