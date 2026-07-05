import fs from "fs"
import path from "path"

const dir = "lib/db/derivedtables"
const files = fs
  .readdirSync(dir)
  .filter(
    (f) =>
      f.endsWith(".ts") &&
      f !== "types.ts" &&
      f !== "component-base.ts" &&
      f !== "setup-derived-tables.ts",
  )

for (const file of files) {
  const filePath = path.join(dir, file)
  let content = fs.readFileSync(filePath, "utf-8")

  // Add extraColumn
  if (
    !content.includes('{ name: "is_extended_promotional", type: "boolean" }')
  ) {
    content = content.replace(
      '{ name: "is_preferred", type: "boolean" },',
      '{ name: "is_preferred", type: "boolean" },\n    { name: "is_extended_promotional", type: "boolean" },',
    )
  }

  // Add property to mapToTable
  if (!content.includes("is_extended_promotional: Boolean")) {
    content = content.replace(
      "is_preferred: Boolean(c.preferred),",
      "is_preferred: Boolean(c.preferred),\n        is_extended_promotional: Boolean((c as any).is_extended_promotional),",
    )
    // some files might use `component` instead of `c`
    content = content.replace(
      "is_preferred: Boolean(component.preferred),",
      "is_preferred: Boolean(component.preferred),\n        is_extended_promotional: Boolean((component as any).is_extended_promotional),",
    )
  }

  fs.writeFileSync(filePath, content)
}
console.log("Updated derived tables")
