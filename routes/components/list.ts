import { z } from "zod"
import { publicProcedure } from "../../lib/trpc"
import { db } from "../../lib/db"

export const listComponents = publicProcedure
  .input(
    z.object({
      // Pagination
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),

      // Filters
      package: z.string().optional(),
      manufacturer: z.string().optional(),
      description: z.string().optional(),
      basic: z.boolean().optional(),
      preferred: z.boolean().optional(),
      is_extended_promotional: z.boolean().optional(),
      in_stock: z.boolean().optional(),

      // Sort
      sort_by: z
        .enum([
          "price1",
          "price10",
          "price100",
          "stock",
          "lcsc",
          "last_updated",
        ])
        .optional(),
      sort_order: z.enum(["asc", "desc"]).default("asc"),
    }),
  )
  .query(async ({ input }) => {
    let query = db.selectFrom("components").selectAll()

    if (input.package) {
      query = query.where("package", "=", input.package)
    }

    if (input.manufacturer) {
      query = query.where("manufacturer", "ilike", `%${input.manufacturer}%`)
    }

    if (input.description) {
      query = query.where("description", "ilike", `%${input.description}%`)
    }

    if (input.basic !== undefined) {
      query = query.where("basic", "=", input.basic ? 1 : 0)
    }

    if (input.preferred !== undefined) {
      query = query.where("preferred", "=", input.preferred ? 1 : 0)
    }

    if (input.is_extended_promotional !== undefined) {
      query = query.where(
        "is_extended_promotional",
        "=",
        input.is_extended_promotional ? 1 : 0,
      )
    }

    if (input.in_stock) {
      query = query.where("stock", ">", 0)
    }

    if (input.sort_by) {
      query = query.orderBy(input.sort_by, input.sort_order)
    }

    query = query.limit(input.limit).offset(input.offset)

    const components = await query.execute()

    return {
      components: components.map((c) => ({
        ...c,
        basic: c.basic === 1,
        preferred: c.preferred === 1,
        is_extended_promotional: c.is_extended_promotional === 1,
      })),
    }
  })
