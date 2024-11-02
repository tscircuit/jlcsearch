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
        .selectAll()
        .innerJoin("categories", "categories.id", "components.category_id")
        .where("categories.subcategory", "=", subcategory)
        // .where("in_stock", "=", true)
        // .orderBy("stock", "desc")
        .limit(2)
        .execute()

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
            table[`extra.attributes["${key}"]`] = value ?? ""
          }
        }

        return table
      })

      if (components.length > 0) {
        markdown += `### ${subcategory}\n\n`
        // Create a table where each row is a key of the table and each
        // column is an example value from the components
        const firstCols = Object.keys({
          ...simplifiedComponents[0],
          ...simplifiedComponents[1],
        })
        markdown += `| Key | Ex1 | Ex2 |\n`
        markdown += `| --- | --- | --- |\n`
        for (const col of firstCols) {
          markdown += `| ${col} | ${simplifiedComponents?.[0]?.[col]} | ${simplifiedComponents?.[1]?.[col]} |\n`
        }
      }
    }
  }

  await writeFile(outputPath, markdown)
  console.log(`Generated documentation at ${outputPath}`)

  await db.destroy()
}

main().catch(console.error)
