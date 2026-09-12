import { ColumnType, Generated } from "kysely"

export interface ComponentsTable {
  lcsc: number
  category_id: number
  mfr: string
  package: string
  joints: number
  description: string
  stock: number
  price: number | null
  last_update: string
  extra: string | null
  in_stock: ColumnType<boolean, boolean | number, boolean | number>
  is_basic: ColumnType<boolean, boolean | number, boolean | number>
  is_preferred: ColumnType<boolean, boolean | number, boolean | number>
  is_extended_promotional: ColumnType<
    boolean,
    boolean | number,
    boolean | number
  >
  images: string | null
  datasheet: string | null
}

export interface CategoriesTable {
  id: Generated<number>
  category: string
  subcategory: string
  component_count: number | null
}

export interface Database {
  components: ComponentsTable
  categories: CategoriesTable
}
