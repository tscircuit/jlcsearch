import { z } from "zod"
import { getDb } from "../../lib/db/get-db"
import { withWinterSpec } from "../../lib/with-winter-spec"
import { paginationParams } from "../../lib/pagination"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  commonParams: z.object({
    ...paginationParams,
    lcsc: z.coerce.number().optional(),
    category_id: z.coerce.number().optional(),
    package: z.string().optional(),
    is_basic: z.coerce.boolean().optional(),
    is_preferred: z.coerce.boolean().optional(),
    is_extended_promotional: z.coerce.boolean().optional(),
    in_stock: z.coerce.boolean().optional(),
    description: z.string().optional(),
  }),
  jsonResponse: z.object({
    components: z.array(
      z.object({
        lcsc: z.number(),
        category_id: z.number(),
        mfr: z.string(),
        package: z.string(),
        joints: z.number(),
        description: z.string(),
        stock: z.number(),
        price: z.number().nullable(),
        last_update: z.string(),
        extra: z.string().nullable(),
        in_stock: z.boolean(),
        is_basic: z.boolean(),
        is_preferred: z.boolean(),
        is_extended_promotional: z.boolean(),
        images: z.string().nullable(),
        datasheet: z.string().nullable(),
      })
    ),
  }),
} as const)(async (req, ctx) => {
  const db = getDb()
  const {
    lcsc,
    category_id,
    package: pkg,
    is_basic,
    is_preferred,
    is_extended_promotional,
    in_stock,
    description,
    limit,
    offset,
  } = ctx.commonParams

  let query = db.selectFrom("components").selectAll()

  if (lcsc !== undefined) {
    query = query.where("lcsc", "=", lcsc)
  }
  if (category_id !== undefined) {
    query = query.where("category_id", "=", category_id)
  }
  if (pkg !== undefined) {
    query = query.where("package", "=", pkg)
  }
  if (is_basic !== undefined) {
    query = query.where("is_basic", "=", is_basic ? 1 : 0)
  }
  if (is_preferred !== undefined) {
    query = query.where("is_preferred", "=", is_preferred ? 1 : 0)
  }
  if (is_extended_promotional !== undefined) {
    query = query.where(
      "is_extended_promotional",
      "=",
      is_extended_promotional ? 1 : 0
    )
  }
  if (in_stock !== undefined) {
    query = query.where("in_stock", "=", in_stock ? 1 : 0)
  }
  if (description !== undefined) {
    query = query.where("description", "like", `%${description}%`)
  }

  const rows = await query
    .limit(limit ?? 100)
    .offset(offset ?? 0)
    .execute()

  return ctx.json({
    components: rows.map((row) => ({
      ...row,
      in_stock: Boolean(row.in_stock),
      is_basic: Boolean(row.is_basic),
      is_preferred: Boolean(row.is_preferred),
      is_extended_promotional: Boolean(row.is_extended_promotional),
    })),
  })
})
