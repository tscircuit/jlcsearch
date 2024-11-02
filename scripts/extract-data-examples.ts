import { mkdir, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { getDbClient } from "lib/db/get-db-client"
import Path from "node:path"

async function main() {
  const db = getDbClient()
  const outputDir = "./docs/generated"
  const outputPath = Path.join(outputDir, "component-overview.md")

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }

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

  let markdown = "# Component Overview\n\n"
  markdown +=
    "This document provides examples of components available in each category.\n\n"

  // For each category and subcategory, get top 3 components by stock
  const totalCategories = Object.keys(categoryGroups).length
  let categoryCount = 0

  for (const [category, subcategories] of Object.entries(categoryGroups)) {
    categoryCount++
    console.log(
      `Processing category ${categoryCount}/${totalCategories}: ${category}`,
    )
    markdown += `## ${category}\n\n`

    const subcategoryArray = Array.from(subcategories)
    let subcategoryCount = 0

    for (const subcategory of subcategoryArray) {
      subcategoryCount++
      console.log(
        `[${categoryCount}/${totalCategories}]  Subcategory ${subcategoryCount}/${subcategoryArray.length}: ${subcategory}`,
      )
      const components = await db
        .selectFrom("components")
        .select([
          "lcsc",
          "mfr",
          "package",
          "description",
          "stock",
          "price",
          "extra",
          "datasheet",
          "price",
          "extra",
        ])
        .innerJoin("categories", "categories.id", "components.category_id")
        .where("categories.subcategory", "=", subcategory)
        .where("in_stock", "=", true)
        .orderBy("stock", "desc")
        .limit(2)
        .execute()

      if (components.length > 0) {
        markdown += `### ${subcategory}\n\n`
        markdown += "```json\n"
        markdown += JSON.stringify(components, null, 2)
        markdown += "\n```\n\n"
      }
    }
  }

  await writeFile(outputPath, markdown)
  console.log(`Generated documentation at ${outputPath}`)

  await db.destroy()
}

main().catch(console.error)
