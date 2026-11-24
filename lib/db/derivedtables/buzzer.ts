import type { BaseComponent } from "./component-base"
import { createDerivedTableSpec } from "./create-derived-table-spec"

export interface Buzzer extends BaseComponent {
  package: string
}

export const buzzerTableSpec = createDerivedTableSpec<Buzzer>({
  tableName: "buzzer",
  extraColumns: [{ name: "package", type: "text" }],
  indexes: [
    { name: "idx_buzzer_stock", columns: ["stock"] },
    {
      name: "idx_buzzer_package_stock",
      columns: ["package", "stock"],
    },
  ],
  subcategory: "Buzzers",
  mapComponent: (component) => ({
    package: String(component.package || ""),
  }),
})
