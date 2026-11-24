import type { SelectQueryBuilder } from "kysely"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import type { Component, Generated } from "../generated/kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export type SourceComponentRow = {
  [K in keyof Component]: Component[K] extends Generated<infer U>
    ? U
    : Component[K]
}

export interface CategorySelection {
  category?: string
  subcategory?: string
  subcategories?: readonly string[]
}

export type CreateDerivedTableSpecOptions<Resource extends BaseComponent> = {
  tableName: string
  extraColumns: Array<{
    name: keyof Resource
    type: string
  }>
  indexes?: Array<{
    name: string
    columns: Array<keyof Resource>
  }>
  mapComponent: (
    component: SourceComponentRow,
    attributes: Record<string, string>,
  ) => Omit<Resource, keyof BaseComponent> | null
} & (
  | {
      listCandidateComponents: (
        db: KyselyDatabaseInstance,
      ) => SelectQueryBuilder<any, any, any>
    }
  | ({ listCandidateComponents?: never } & CategorySelection)
)

const DEFAULT_ASSEMBLY_COLUMNS = [
  { name: "is_basic", type: "boolean" },
  { name: "is_preferred", type: "boolean" },
] as const

export const parseComponentAttributes = (
  extra: string | null | undefined,
): Record<string, string> => {
  if (!extra) return {}
  try {
    const parsed = JSON.parse(extra)?.attributes
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  } catch {
    // Ignore malformed optional metadata.
  }
  return {}
}

export const extractBaseComponentFields = (
  component: SourceComponentRow,
  attributes: Record<string, string> = parseComponentAttributes(
    component.extra,
  ),
): BaseComponent => ({
  lcsc: Number(component.lcsc),
  mfr: String(component.mfr || ""),
  description: String(component.description || ""),
  stock: Number(component.stock || 0),
  price1: extractMinQPrice(component.price),
  in_stock: Number(component.stock || 0) > 0,
  is_basic: Boolean(component.basic),
  is_preferred: Boolean(component.preferred),
  attributes,
})

export const selectCategoryComponents = (
  db: KyselyDatabaseInstance,
  selection: CategorySelection,
): SelectQueryBuilder<any, any, any> => {
  let query: any = db
    .selectFrom("components")
    .innerJoin("categories", "components.category_id", "categories.id")
    .selectAll()

  if (selection.category) {
    query = query.where("categories.category", "=", selection.category)
  }
  if (selection.subcategory) {
    query = query.where("categories.subcategory", "=", selection.subcategory)
  }
  if (selection.subcategories && selection.subcategories.length > 0) {
    query = query.where("categories.subcategory", "in", [
      ...selection.subcategories,
    ])
  }

  return query
}

/**
 * Factory for authoring DRY `DerivedTableSpec` definitions.
 *
 * Automatically ensures `is_basic` and `is_preferred` columns are present,
 * builds standard category/subcategory candidate queries, parses component
 * attributes safely, and merges shared `BaseComponent` fields so each
 * category spec only needs to return its category-specific columns.
 */
export function createDerivedTableSpec<Resource extends BaseComponent>(
  options: CreateDerivedTableSpecOptions<Resource>,
): DerivedTableSpec<Resource> {
  const existingColumnNames = new Set(
    options.extraColumns.map((col) => String(col.name)),
  )
  const extraColumns: Array<{ name: keyof Resource; type: string }> = [
    ...options.extraColumns,
    ...DEFAULT_ASSEMBLY_COLUMNS.filter(
      (col) => !existingColumnNames.has(col.name),
    ).map((col) => ({
      name: col.name as keyof Resource,
      type: col.type,
    })),
  ]

  const listCandidateComponents =
    "listCandidateComponents" in options && options.listCandidateComponents
      ? options.listCandidateComponents
      : (db: KyselyDatabaseInstance) =>
          selectCategoryComponents(db, options as CategorySelection)

  return {
    tableName: options.tableName,
    extraColumns,
    ...(options.indexes ? { indexes: options.indexes } : {}),
    listCandidateComponents,
    mapToTable: (components) =>
      components.map((component) => {
        const attributes = parseComponentAttributes(component.extra)
        const extraFields = options.mapComponent(component, attributes)
        if (extraFields === null) return null
        return {
          ...extractBaseComponentFields(component, attributes),
          ...extraFields,
        } as Resource
      }),
  }
}
