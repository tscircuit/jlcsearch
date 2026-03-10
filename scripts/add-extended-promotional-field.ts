#!/usr/bin/env bun
/**
 * 批量添加 is_extended_promotional 字段到所有组件表
 * 
 * 用法：bun run scripts/add-extended-promotional-field.ts
 */

import { readdir, readFile, writeFile } from "fs/promises"
import { join } from "path"

const DERIVED_TABLES_DIR = join(import.meta.dir, "..", "lib", "db", "derivedtables")

async function main() {
  console.log("🔧 批量添加 is_extended_promotional 字段\n")
  
  const files = await readdir(DERIVED_TABLES_DIR)
  const tsFiles = files.filter(f => f.endsWith(".ts") && f !== "component-base.ts" && f !== "types.ts" && f !== "setup-derived-tables.ts")
  
  let updatedCount = 0
  let skippedCount = 0
  
  for (const file of tsFiles) {
    const filePath = join(DERIVED_TABLES_DIR, file)
    const content = await readFile(filePath, "utf-8")
    
    // 检查是否已经有这个字段
    if (content.includes("is_extended_promotional")) {
      console.log(`⏭️  跳过：${file} (已存在)`)
      skippedCount++
      continue
    }
    
    // 检查是否有 extraColumns 定义
    if (!content.includes("extraColumns:")) {
      console.log(`⏭️  跳过：${file} (无 extraColumns)`)
      skippedCount++
      continue
    }
    
    let newContent = content
    
    // 1. 添加 extraColumns 字段定义
    newContent = newContent.replace(
      /(\{ name: "is_preferred", type: "boolean" \},)/,
      '$1\n    { name: "is_extended_promotional", type: "boolean" },'
    )
    
    // 2. 添加 return 语句中的字段
    newContent = newContent.replace(
      /(is_preferred: Boolean\(c\.preferred\),)/,
      '$1\n        is_extended_promotional: Boolean(c.extended_promotional),'
    )
    
    // 写回文件
    await writeFile(filePath, newContent, "utf-8")
    console.log(`✅ 更新：${file}`)
    updatedCount++
  }
  
  console.log("\n" + "=".repeat(50))
  console.log(`✅ 完成！`)
  console.log(`   更新：${updatedCount} 个文件`)
  console.log(`   跳过：${skippedCount} 个文件`)
  console.log(`   总计：${tsFiles.length} 个文件`)
}

main().catch(console.error)
