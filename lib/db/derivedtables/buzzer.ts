import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import type { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export interface Buzzer extends BaseComponent {
  package: string
}

export const buzzerTableSpec: DerivedTableSpec<Buzzer> = {
  tableName: "buzzer",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  indexes: [
    { name: "idx_buzzer_stock", columns: ["stock"] },
    {
      name: "idx_buzzer_package_stock",
      columns: ["package", "stock"],
    },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.subcategory", "=", "Buzzers"),
  mapToTable: (components) =>
    components.map((component) => {
      let attributes: Record<string, string> = {}
      try {
        const parsed = JSON.parse(component.extra || "{}")?.attributes
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          attributes = parsed
      } catch {
        // Keep classified parts even when optional metadata is malformed.
      }
      return {
        lcsc: Number(component.lcsc),
        mfr: String(component.mfr || ""),
        description: String(component.description || ""),
        package: String(component.package || ""),
        stock: Number(component.stock || 0),
        price1: extractMinQPrice(component.price),
        in_stock: Number(component.stock || 0) > 0,
        is_basic: Boolean(component.basic),
        is_preferred: Boolean(component.preferred),
        attributes,
      }
    }),
}
