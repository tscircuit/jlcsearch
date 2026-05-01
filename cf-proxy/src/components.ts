import type { Kysely } from "kysely"
import type { DB } from "./db/types"
import { searchIndex } from "./search"

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
  const rows = await searchIndex(db, {
    q: params.search,
    package: params.package,
    subcategory_name: params.subcategory_name,
    is_basic: params.is_basic,
    is_preferred: params.is_preferred,
    limit: "100",
  })

  return rows.map((row) => ({
    ...row,
    extra: null,
  }))
}
