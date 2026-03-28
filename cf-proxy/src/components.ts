import type { Kysely } from "kysely"
import type { DB } from "./db/types"

export interface ComponentCatalogQueryParams {
  subcategory_name?: string
  package?: string
  search?: string
  is_basic?: string
  is_preferred?: string
}

export async function queryComponentCatalog(
  db: Kysely<DB>,
  params: ComponentCatalogQueryParams,
): Promise<
  Array<{
    lcsc: number | null
    category: string | null
    subcategory: string | null
    mfr: string | null
    package: string | null
    basic: number | null
    preferred: number | null
    description: string | null
    stock: number | null
    price: string | null
    extra: string | null
  }>
> {
  let query = db
    .selectFrom("component_catalog")
    .selectAll()
    .where("stock", ">", 0)
    .orderBy("stock", "desc")
    .limit(100)

  if (params.subcategory_name) {
    query = query.where("subcategory", "=", params.subcategory_name)
  }

  if (params.package) {
    query = query.where("package", "=", params.package)
  }

  if (params.is_basic === "true") {
    query = query.where("basic", "=", 1)
  }

  if (params.is_preferred === "true") {
    query = query.where("preferred", "=", 1)
  }

  if (params.search) {
    const raw = params.search.trim()
    const pattern = `%${raw.toLowerCase()}%`

    query = query.where((eb) =>
      eb("description", "like", pattern)
        .or("mfr", "like", pattern)
        .or("package", "like", pattern),
    )
  }

  return await query.execute()
}
