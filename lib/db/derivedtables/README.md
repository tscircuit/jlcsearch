# Derived Table Specifications

Files in `lib/db/derivedtables/` are **hand-authored table specifications** (not code-generated outputs). Each file exports a `DerivedTableSpec<T>` that `setup-derived-tables.ts` uses to create and populate a category-specific SQLite table from the raw `components` and `categories` tables.

## Authoring a New Derived Table

Use `createDerivedTableSpec` from `./create-derived-table-spec` to avoid repeating shared `BaseComponent` column definitions (`is_basic`, `is_preferred`), category joins, JSON attribute parsing, and base field extraction:

```ts
import type { BaseComponent } from "./component-base"
import { createDerivedTableSpec } from "./create-derived-table-spec"

export interface Buzzer extends BaseComponent {
  package: string
}

export const buzzerTableSpec = createDerivedTableSpec<Buzzer>({
  tableName: "buzzer",
  extraColumns: [{ name: "package", type: "text" }],
  subcategory: "Buzzers",
  mapComponent: (component) => ({
    package: String(component.package || ""),
  }),
})
```

Then register the spec in `DERIVED_TABLES` inside `setup-derived-tables.ts`.
