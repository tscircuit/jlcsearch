import { mkdir, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { getDbClient } from "lib/db/get-db-client"
import Path from "node:path"

const EXCLUDED_CATEGORIES: string[] = [
  "_",
  "buildingmaterialsbuildinghardware",
  "cleaningdaily_necessities",
  "consumable_items",
  "consumables",
  "development_boards__tools",
  "educational_kits",
  "electronic_toolsinstrumentsconsumables",
  "global_sourcing_parts",
  "handlingpackingstorage",
  "hardware_fastenersseals",
  "hardwarefastenerssealing",
  "hardwares__others",
  "hardwares__sealings__machinings",
  "hardwaressoldersaccessoriesbatteries",
  "industrial_control_electrical",
  "industrial_reagentslubricationrust_prevention",
  "instrumentationmeter",
  "instruments",
  "instrumentstools",
  "labor_protection_supplies",
  "laboratory_supplies",
  "lathes_and_accessories",
  "measuring_tools",
  "office_supplies",
  "old_batch",
  "other",
  "others",
  "pneumatichydraulicpipe_valvepump",
  "securityfirefighting",
  "solders__accessories__batteries",
  "test",
  "tool",
  "tools_consumables",
  "wirecabledatacable",
]

function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
}

async function main() {
  const db = getDbClient()
  const outputDir = "./docs/generated"

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }

  // Create index file content
  let indexMarkdown = "# Component Overview\n\n"
  indexMarkdown +=
    "This document provides examples of components available in each category.\n\n"
  indexMarkdown += "## Categories\n\n"

  // Get all categories and subcategories
  const categories = await db
    .selectFrom("categories")
    .select(["category", "subcategory"])
    .execute()

  // Group by category
  const categoryGroups = categories.reduce(
    (acc, { category, subcategory }) => {
      if (!acc[category]) {
        acc[category] = new Set()
      }
      acc[category].add(subcategory)
      return acc
    },
    {} as Record<string, Set<string>>,
  )

  // For each category and subcategory, get top 3 components by stock
  const totalCategories = Object.keys(categoryGroups).length
  let categoryCount = 0

  for (const [category, subcategories] of Object.entries(categoryGroups)) {
    categoryCount++
    console.log(
      `Processing category ${categoryCount}/${totalCategories}: ${category}`,
    )

    const snakeCaseCategory = toSnakeCase(category)

    if (EXCLUDED_CATEGORIES.includes(snakeCaseCategory)) {
      continue
    }

    const categoryFileName = `${snakeCaseCategory}.md`
    indexMarkdown += `- [${category}](./${categoryFileName})\n`
    let categoryMarkdown = `# ${category}\n\n`

    const subcategoryArray = Array.from(subcategories)
    let subcategoryCount = 0

    for (const subcategory of subcategoryArray) {
      subcategoryCount++
      console.log(
        `${category}[${categoryCount}/${totalCategories}] ${subcategory}[${subcategoryCount}/${subcategoryArray.length}: ${subcategory}]`,
      )
      const components = await db
        .selectFrom("components")
        .selectAll()
        .innerJoin("categories", "categories.id", "components.category_id")
        .where("categories.subcategory", "=", subcategory)
        // @ts-expect-error i have no idea why this is happening
        .where("components.in_stock", "=", 1)
        .orderBy("stock", "desc")
        .limit(2)
        .execute()

      if (components.length < 2) {
        continue
      }

      for (const component of components) {
        component.extra = JSON.parse(component.extra ?? "{}")
        component.price = JSON.parse(component.price ?? "[]")
      }

      const simplifiedComponents = components.map((component) => {
        const table: any = {}
        const extra: any = component.extra ?? {}
        const price: any = component.price ?? []

        table.lcsc = component.lcsc
        table.stock = component.stock
        table.mfr = component.mfr
        table.package = component.package
        table.joints = component.joints
        table.description = component.description
        table.min_q_price = price?.[0]?.price
        table.extra_title = extra?.title ?? ""
        table["extra.number"] = extra?.number ?? ""
        table["extra.package"] = extra?.package ?? ""
        if (extra?.attributes) {
          for (const [key, value] of Object.entries(extra.attributes)) {
            table[`extra.attributes["${key}"]`] =
              value === "undefined" ? "" : (value ?? "")
          }
        }

        return table
      })

      if (components.length > 0) {
        categoryMarkdown += `### ${subcategory}\n\n`
        // Create a table where each row is a key of the table and each
        // column is an example value from the components
        const firstCols = Object.keys({
          ...simplifiedComponents[0],
          ...simplifiedComponents[1],
        })
        categoryMarkdown += `| Key | Ex1 | Ex2 |\n`
        categoryMarkdown += `| --- | --- | --- |\n`
        for (const col of firstCols) {
          categoryMarkdown += `| ${col} | ${simplifiedComponents?.[0]?.[col]} | ${simplifiedComponents?.[1]?.[col] ?? ""} |\n`
        }
        categoryMarkdown += "\n"
      }
    }

    // Write category file
    const categoryPath = Path.join(outputDir, categoryFileName)
    await writeFile(categoryPath, categoryMarkdown)
    console.log(`Generated category documentation at ${categoryPath}`)
  }

  // Write index file
  const indexPath = Path.join("./docs/generated", "component-overview.md")
  await writeFile(indexPath, indexMarkdown)
  console.log(`Generated index at ${indexPath}`)

  await db.destroy()
}

main().catch(console.error)
